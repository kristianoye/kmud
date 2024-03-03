/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

const
    LS_OPT_LONGFORMAT = 1 << 0, // Show output in long format
    LS_OPT_SHOWSIZE = 1 << 1,   // Include file size
    LS_OPT_SINGLECOL = 1 << 2,  // Show output in a single column
    LS_OPT_COLFORMAT = 1 << 3,  // Show output in columns
    LS_OPT_PLAINTEXT = 1 << 4,  // Do not display in Explorer
    LS_OPT_COLOR = 1 << 5,      // Show colors
    LS_OPT_CLASSIFY = 1 << 6,   // Append classification for file types (e.g. / for directories)
    LS_OPT_RECURSIVE = 1 << 7;

const
    DisplayFormats = {
        across: 'across',
        commas: 'commas',
        horizontal: 'horizontal',
        long: 'long',
        'single-column': 'singleColumn',
        singleColumn: 'singleColumn',
        verbose: 'long',
        vertical: 'vertical'
    },
    ValidFormats = Object.keys(DisplayFormats);

class DirectoryEntry {
    /**
     * Construct a list options object
     * @param {MUDObject} player The player executing the command
     * @param {DirectoryEntry} [parent] The parent options object
     */
    create(player, parent) {
        super.create();
        this.directories = {};
        this.files = [];
        this.format = "across";
        this.player = player;
        if (parent) {
            this.format = parent.format;
            this.player = parent.player;
        }
    }

    get directories() {
        return get([]);
    }

    protected set directories(val) {
        if (Array.isArray(val))
            set(val);
    }

    get directoryNames() {
        return Object.keys(this.directories).sort();
    }

    get files() {
        return get([]);
    }

    protected set files(a) {
        if (Array.isArray(a))
            set(a);
    }

    get format() {
        return get("across");
    }

    set format(s) {
        if (typeof s === 'string' && ValidFormats.indexOf(s) > -1)
            set(s);
    }

    get path() {
        return get('/');
    }

    set path(s) {
        if (typeof s === 'string') set(s);
    }

    get player() {
        return get();
    }

    protected set player(o) {
        set(o);
    }
}

export default singleton class LsCommand extends Command {
    override async cmd(text, cmdline) {
        let player = thisPlayer(),
            opts =  await createAsync(DirectoryEntry, player),
            cwd = player.workingDirectory,
            getDirFlags = 0,
            displayFlags = LS_OPT_COLOR | LS_OPT_CLASSIFY | LS_OPT_COLFORMAT,
            targetList = [],
            files = [],
            args = cmdline.args;

        for (let i = 0, m = args.length; i < m; i++) {
            let opt = args[i];

            if (typeof opt === 'string') {
                if (opt.startsWith('-')) {
                    let optList = opt.charAt(1) === '-' ? [opt] : opt.slice(1).split('');

                    for (let j = 0; j < optList.length; j++) {
                        let [cmdarg, arg] = optList[j].split('=', 2);

                        switch (cmdarg) {
                            case 'a':
                                getDirFlags |= MUDFS.GetDirFlags.Hidden;
                                break;

                            case '--color':
                                if (arg === 'never')
                                    displayFlags &= ~LS_OPT_COLOR;
                                else
                                    displayFlags |= LS_OPT_COLOR;
                                break;

                            case 'd': case '--directory':
                                getDirFlags |= MUDFS.GetDirFlags.Dirs;
                                break;

                            case '--format':
                                if (ValidFormats.indexOf(arg) === -1)
                                    return `${cmdline.verb}: Invalid argument '${arg}' for '${cmdarg}'`;
                                opts.format = arg;
                                break;

                            case 'l': case '--long':
                                opts.format = DisplayFormats.verbose;
                                break;

                            case 'p':
                                getDirFlags |= MUDFS.GetDirFlags.Perms;
                                break;

                            case 's':
                                getDirFlags |= MUDFS.GetDirFlags.Size;
                                displayFlags |= LS_OPT_SHOWSIZE;
                                break;

                            case '1':
                                opts.format = DisplayFormats.singleColumn;
                                break;

                            case 'C':
                                displayFlags |= LS_OPT_COLFORMAT;
                                break;

                            case 'F':
                                displayFlags |= LS_OPT_CLASSIFY;
                                break;

                            case 'P':
                                getDirFlags = getDirFlags.setFlag(MUDFS.GetDirFlags.Files);
                                break;

                            case 'R':
                            case '--recursive':
                                displayFlags = displayFlags.setFlag(LS_OPT_RECURSIVE);
                                break;

                            case 's':
                            case '--size':
                                displayFlags = displayFlags.set(LS_OPT_SHOWSIZE);
                                break;

                            case 'T':
                            case '--text':
                                displayFlags = displayFlags.setFlag(LS_OPT_PLAINTEXT);
                                break;

                            default:
                                return `ls: unknown option: -${cmdarg}`;
                        }
                    }
                }
                else 
                    targetList.push(efuns.resolvePath(args[i], cwd));
            }
            else if (typeof opt === 'object') {
                files.push(opt);
            }
        }

        if (getDirFlags === 0)
            getDirFlags = MUDFS.GetDirFlags.Defaults;

        if ((getDirFlags & (MUDFS.GetDirFlags.Files | MUDFS.GetDirFlags.Dirs)) === 0)
            getDirFlags = getDirFlags.setFlag(MUDFS.GetDirFlags.Files | MUDFS.GetDirFlags.Dirs);

        if (targetList.length === 0) {
            targetList.push(cwd || '/');
        }

        for (let i = 0; i < targetList.length; i++) {
            try {
                let stat = await efuns.fs.getObjectAsync(targetList[i]);

                if (!stat.exists)
                    errorLine(`ls: cannot access ${expr}: No such file or directory`);
                else if (stat.isDirectory)
                    files.push(... await stat.readAsync());
                else if (stat.isFile)
                    files.push(stat);
            }
            catch (err) {
                return `${targetList[i]}: ${err.message}`;
            }
        }

        await files.forEachAsync(async fo => {
            /** @type {DirectoryEntry} */
            let dir = opts.directories[fo.directory];
            if (!dir) {
                dir = opts.directories[fo.directory] = await createAsync(DirectoryEntry, null, opts);
                dir.path = fo.directory;
            }
            dir.files.push(fo);
        });

        let result = [], dirs = opts.directoryNames;

        for (let i = 0; i < dirs.length; i++) {
            let opt = opts.directories[dirs[i]];

            switch (DisplayFormats[opts.format]) {

                case DisplayFormats.across:
                    result.push(await this.displayColumnListing(opt, dirs.length > 0, displayFlags));
                    break;

                case DisplayFormats.long:
                    result.push(await this.displayLongListing(opt, dirs.length > 0, displayFlags));
                    break;

                case DisplayFormats.singleColumn:
                    result.push(await this.displaySingleColumn(opt, dirs.length > 0, displayFlags));
                    break;

                default:
                    return `Unknown display format: ${opts.format}`;
            }
        }

        return writeLine(result.join('\n'));
    }

    /**
     * List a directory in a single column format.
     * @param {DirectoryEntry} opt
     */
    async displayColumnListing(opt, multi = false, displayFlags = 0) {
        let buffer = '', total = 0;

        if (multi)
            buffer += '\n' + opt.path + ':\n';

        if (opt.files.length > 0) {
            let maxLength = 0;

            let files = opt.files.map(stat => {
                let output = this.displayColumnName(stat, displayFlags);

                if (opt.format & LS_OPT_SHOWSIZE) {
                    let size = efuns.getMemSizeString(stat.size);
                    output = efuns.sprintf('%5s %s', size, stat.name);
                }
                if (opt.format & LS_OPT_CLASSIFY) {
                    if (stat.isSymbolicLink) output += '@';
                    if (stat.isDirectory) output += '/';
                }
                maxLength = Math.max(maxLength, output.length);
                return output;
            });

            buffer += efuns.columnText(files, undefined, opt.player);
        }
        if (opt.directories.length > 0) {
            for (let i = 0; i < opt.directories.length; i++) {
                let stat = opt.directories[i];
                let subdir = await createAsync(DirectoryEntry, opt.player, opt);

                subdir.files = await stat.readAsync();
                subdir.files = subdir.files.map(f => [f.name, f]);
                buffer += `${display}:\n`;
                buffer += await this.displayColumnListing(subdir);
            }
        }
        return buffer;
    }

    /**
     * 
     * @param {DirectoryEntry} dir
     */
    async displayLongListing(dir, multi = false, displayOptions = 0) {
        try {
            let buffer = '', total = 0;

            if (dir.files.length > 0) {
                for (const fo of dir.files) {
                    buffer += efuns.sprintf('%-12s %10s %10s %10s %-18s',
                        await fo.getPermString(),
                        await fo.getOwnerName(),
                        'group',
                        fo.isDirectory ? '[DIR]' : efuns.getMemSizeString(fo.size),
                        fo.ctime.toISOString().slice(0, 16));

                    buffer += this.displayColumnName(fo, displayOptions) + '\n';
                    total += fo.size < 1 ? 0 : fo.size;
                }

                if (total > 0)
                    buffer = `total ${efuns.getMemSizeString(total)}` + efuns.eol + buffer;
            }
            return buffer
        }
        catch (x) {
            return x.message;
        }
    }

    /**
     * 
     * @param {FileSystemObject} fo
     * @param {number} flags
     */
    displayColumnName(fo, flags) {
        let result = fo.name;

        if (flags & LS_OPT_COLOR) {
            if (fo.isDirectory) {
                result = "%^BLUE%^%^BOLD%^" + result + "%^RESET%^";
            }
            else if (fo.isLoaded) {
                result = "%^GREEN%^%^BOLD%^" + result + "%^RESET%^";
            }
            else if (fo.fullPath.endsWith('.js') || fo.fullPath.endsWith('.jsx')) {
                result = "%^GREEN%^" + result + "%^RESET%^";
            }
        }
        if (flags & LS_OPT_CLASSIFY) {
            if (fo.isDirectory)
                result += '/';
        }
        return result;
    }

    /**
     * List a directory in a single column format.
     * @param {DirectoryEntry} dir The directory to display
     * @param {boolean} showDirName
     */
    displaySingleColumn(dir, showDirName, displayFlags) {
        let buffer = (showDirName ? `\n${dir.path}:\n` : '');

        buffer += dir.files.map(fo => {
            let result = '';
            if (displayFlags & LS_OPT_SHOWSIZE)
                result += efuns.sprintf('%-3s ', fo.size < 0 ? '0' : Math.floor(fo.size/1024) || '1');
            result += this.displayColumnName(fo, displayFlags);
            return result;
        }).join('\n');

        return buffer;
    }

    webListing(path, tp) {
        var parts = path.split('/'), dirs = [], dir = '', result = {};

        for (var i = 0, max = parts.length; i < max; i++) {
            var newdir = parts.slice(0, i + 1).join('/') + '/';
            dirs.push(newdir);
            var listing = {
                id: newdir,
                text: parts[i] + '/',
                parent: dir.length === 0 ? '#' : dir,
                opened: true
            };
            result[listing.id] = listing;
            dir = newdir;
        }
        async.forEach(dirs, (dir, callback) => {
            efuns.fs.readDirectory(dir, 1, (files, err) => {
                files.forEach(a => {
                    var lid = dir + a[0] + (a[1] === -2 ? '/' : ''),
                        listing = {
                            children: a[1] === -2,
                            id: lid,
                            text: lid,
                            parent: dir,
                            opened: result[lid] ? result[lid.opened] : false
                    };
                    result[listing.id] = listing;
                });
                callback();
            });
        }, err => {
            tp.eventSend({
                type: 'kmud.wizShell.dir',
                data: {
                    result: result,
                    title: path
                }
            });
        });
        return true;
    }

    getHelpX() {
        return {
            type: 'command',
            category: 'Commands > Creator Commands > Filesystem',
            description: `
                <p>The <b>ls</b> command returns listings of objects contained
                within the filesystem.</p>
            `,
            options: [
                {
                    switches: ['-c', '--column'],
                    description: 'Show results in column mode format.'
                },
                {
                    switches: ['-d', '--directory'],
                    description: 'Display directory entries but not their contents.'
                },
                {
                    switches: ['-l', '--long'],
                    description: 'Display resuts in long/wide format.'
                }
            ],
            command: 'ls',
            name: 'ls - List directories',
            usage: 'ls [OPTIONS]... [FILE]...',
            seeAlso: 'rmdir, mkdir, cp, mv, rm'
        };
    }

    override get verbs() {
        return ['ls', 'dir'];
    }
}
