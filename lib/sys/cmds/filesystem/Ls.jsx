/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

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

class ListOptions {
    /**
     * Construct a list options object
     * @param {MUDObject} player The player executing the command
     * @param {ListOptions} [parent] The parent options object
     */
    constructor(player, parent) {
        this.directories = [];
        this.files = [];
        this.format = "across";
        this.player = player;
        if (parent) {
            this.format = parent.format;
            this.player = parent.player;
        }
    }
}

class LsCommand extends Command {
    async cmd(text, cmdline) {
        let player = thisPlayer(),
            opts = new ListOptions(player),
            cwd = player.workingDirectory,
            getDirFlags = 0,
            displayFlags = 0,
            targetList = [],
            args = cmdline.args;

        for (var i = 0; i < args.length; i++) {
            var opt = args[i];

            if (opt.startsWith('-')) {
                let optList = opt.charAt(1) === '-' ? [opt] : opt.slice(1).split('');

                for (let j = 0; j < optList.length; j++) {
                    let [cmdarg, arg] = optList[j].split('=', 2);

                    switch (cmdarg) {
                        case 'a':
                            getDirFlags |= MUDFS.GetDirFlags.Hidden;
                            break;

                        case '--color':
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
                            getDirFlags |= MUDFS.GetDirFlags.Files;
                            break;

                        case 'R':
                        case '--recursive':
                            displayFlags |= LS_OPT_RECURSIVE;
                            break;

                        case 's':
                        case '--size':
                            displayFlags |= LS_OPT_SHOWSIZE;
                            break;

                        case 'T':
                        case '--text':
                            displayFlags |= LS_OPT_PLAINTEXT;
                            break;

                        default:
                            return `ls: unknown option: -${cmdarg}`;
                    }
                }
            }
            else {
                targetList.push([
                    args[i],
                    efuns.resolvePath(args[i], cwd)
                ]);
            }
        }

        if (getDirFlags === 0)
            getDirFlags = MUDFS.GetDirFlags.Defaults;

        if ((getDirFlags & (MUDFS.GetDirFlags.Files | MUDFS.GetDirFlags.Dirs)) === 0)
            getDirFlags |= MUDFS.GetDirFlags.Files | MUDFS.GetDirFlags.Dirs;

        if (displayFlags === 0)
            displayFlags = LS_OPT_COLOR | LS_OPT_CLASSIFY | LS_OPT_COLFORMAT;

        if (targetList.length === 0) {
            targetList.push([cwd || '/', cwd || '/']);
        }

        for (let i = 0; i < targetList.length; i++) {
            try {
                let [expr, resolved] = targetList[i];
                let stat = await efuns.fs.statAsync(resolved);

                if (!stat.isFile() && !stat.isDirectory()) {
                    errorLine(`ls: cannot access ${expr}: No such file or directory`);
                }
                else if (stat.isDirectory()) {
                    opts.directories.push([expr, stat, resolved]);
                }
                else {
                    opts.files.push([expr, stat, resolved]);
                }
            }
            catch (err) {
                return `${targetList[i]}: ${err.message}`;
            }
        }

        let result = '';
        switch (DisplayFormats[opts.format]) {

            case DisplayFormats.across:
                result = await this.displayColumnListing(opts);
                break;

            case DisplayFormats.long:
                result = this.displayLongListing(opts);
                break;

            case DisplayFormats.singleColumn:
                result = this.displaySingleColumn(opts);
                break;

            default:
                return `Unknown display format: ${opts.format}`;
        }

        return writeLine(result);
    }

    async readDirectory(dir) {
        let files = await efuns.readDirectoryAsync(dir, MUDFS.GetDirFlags.Details)
        return files.map(stat => {
            return [
                stat.name,
                stat,
                `${dir}/${stat.name}`
            ]
        });
    }

    /**
     * List a directory in a single column format.
     * @param {ListOptions} opts
     */
    async displayColumnListing(opts) {
        let buffer = '', total = 0;

        if (opts.files.length > 0) {
            let maxLength = 0;

            let files = opts.files.map(e => {
                let [display, stat] = e;
                let output = display;

                if (opts.format & LS_OPT_SHOWSIZE) {
                    let size = efuns.getMemSizeString(stat.size);
                    output = efuns.sprintf('%5s %s', size, display);
                }
                if (opts.format & LS_OPT_CLASSIFY) {
                    if (stat.isSymbolicLink()) output += '@';
                    if (stat.isDirectory()) output += '/';
                }
                maxLength = Math.max(maxLength, output.length);
                return output;
            });

            buffer += efuns.columnText(files, undefined, opts.player);
        }
        if (opts.directories.length > 0) {
            for (let i = 0; i < opts.directories.length; i++) {
                let [display, stat, resolved] = opts.directories[i];
                let subdir = new ListOptions(opts.player, opts);

                subdir.files = await this.readDirectory(`${resolved}/`);
                buffer += `${display}:\n`;
                buffer += await this.displayColumnListing(subdir);
            }
        }
        return buffer;
    }

    /**
     * 
     * @param {ListOptions} opts
     */
    displayLongListing(opts) {
        try {
            let buffer = '', total = 0;

            if (opts.files.length > 0) {
                opts.files.forEach(fi => {
                    buffer += efuns.sprintf('%5s %10s %10s %10s %-18s',
                        '',
                        'owner',
                        'group',
                        (fi.size === -2) ? '[DIR]' : efuns.getMemSizeString(fi.size),
                        fi.mtime.toISOString().slice(0, 16))
                        + this.displayColumnName(fi, LS_OPT_COLOR) + '\n';

                    total += fi.blocks;
                });

                if (total > 0)
                    buffer = `total ${total}` + efuns.eol + buffer;
            }
            return writeLine(buffer);
        }
        catch (x) {
            return x.message;
        }
    }

    /**
     * 
     * @param {FileSystemStat} fi
     * @param {number} flags
     */
    displayColumnName(fi, flags) {
        let result = fi.name;
        if (flags & LS_OPT_COLOR) {
            if (fi.isDirectory()) {
                result = "%^BLUE%^%^BOLD%^" + result + "%^RESET%^";
            }
            else if (efuns.findObject(fi.path)) {
                result = "%^GREEN%^%^BOLD%^" + result + "%^RESET%^";
            }
            else if (fi.name.endsWith('.js') || fi.name.endsWith('.jsx')) {
                result = "%^GREEN%^" + result + "%^RESET%^";
            }
        }
        if (flags & LS_OPT_CLASSIFY) {
            if (fi.isDirectory)
                result += '/';
        }
        return result;
    }

    /**
     * List a directory in a single column format.
     * @param {string} dir
     * @param {FileSystemStat[]} files
     * @param {number} displayFlags
     * @param {boolean} showDirName
     */
    displaySingleColumn(dir, files, displayFlags, showDirName) {
        let buffer = '';
        if (showDirName) buffer += `${dir}:\n`;
        if (!Array.isArray(files)) {
            buffer += `Error: ${dir}: ${files}`;
        }
        else {
            buffer += files.map(fi => {
                let result = '';
                if (displayFlags & LS_OPT_SHOWSIZE)
                    result += efuns.sprintf('%-3s ', fi.size < 0 ? '0' : Math.floor(fi.size/1024) || '1');
                result += this.displayColumnName(fi, displayFlags);
                return result;
            }).join('\n');
        }
        writeLine(buffer);
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
            efuns.readDirectory(dir, 1, (files, err) => {
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
}

module.exports = await createAsync(LsCommand);
