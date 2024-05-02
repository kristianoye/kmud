/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_SHELLCMD } from 'Base';
import ShellCommand from LIB_SHELLCMD;

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
    DisplayFlags = Object.freeze({
        ShowAll: 1 << 0,
        HideImpliedDirectories: 1 << 1,
        ShowEscapes: 1 << 2,
        HideGroup: 1 << 3,
        HideOwner: 1 << 4,
        ShowHumanSize: 1 << 5,
        ShowSize: 1 << 6,
        HideBackups: 1 << 7,
        ShowDirectoriesOnly: 1 << 8,
        AppendDirectorySlash: 1 << 9,
        QuoteNames: 1 << 10,
        ShowInode: 1 << 11
    }),
    DisplayFormats = Object.freeze({
        across: 'across',
        commas: 'commas',
        horizontal: 'horizontal',
        long: 'long',
        singleColumn: 'singlecolumn',
        verbose: 'long',
        vertical: 'vertical'
    }),
    SortBy = Object.freeze({
        Default: 'name',
        CTime: 'ctime',
        Birth: 'birthtime',
        Extension: 'extension',
        Size: 'size'
    }),
    SortOrder = Object.freeze({
        Ascending: 'Ascending',
        Default: 'Ascending',
        Descending: 'Descending'
    }),
    ValidFormats = Object.keys(DisplayFormats);

/**
 * @typedef {Object} LsOptions
 * @property {string[]} FILES The files to list
 * @property {number} listingFlags Flags to control the selection of files
 * @property {number} displayFlags Flags to control the displaying of file info
 * @property {'always'|'always'|'auto'|'never'} COLORWHEN When to display colors
 * @property {'across'|'commas'|'horizontal'|'long'|'singleColumn'|'long'|'vertical'} FORMAT The format in which to display file info
 * @property {'name'|'ctime'|'birthtime'|'extension'|'size'} SORTBY The property by which to sort files
 * @property {'Ascending'|'Descending'} SORTORDER
 * 
 * @typedef {Object} LsDirEntry
 * @property {string} display The name to display
 * @property {object} entry The file object for the directory
 * @property {LsDirEntry[]} files The files in the directory
 * 
 * @typedef {Object.<string,LsDirEntry>} LsDirCollection
 */
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

export default singleton class LsCommand extends ShellCommand {
    protected override create() {
        super.create();
        this.verbs = ['ls', 'Get-ChildItem', 'gci', 'dir'];
        this.command
            .setVerb(...this.verbs)
            .setBitflagBucketName('listingFlags')
            .setDescription('List directory contents')
            .setDefaults({ FORMAT: DisplayFormats.across, SORTBY: SortBy.Default, SORTORDER: SortOrder.Default, COLORWHEN: 'always' })
            .addOption('-a, --all', 'Do not ignore entries starting with .', { name: 'showAll', bitflag: 'displayFlags', sets: DisplayFlags.ShowAll, clears: DisplayFlags.HideImpliedDirectories })
            .addOption('-A, --almost-all', 'Do not list implied . and ..', { name: 'showAlmostAll', sets: DisplayFlags.ShowAll | DisplayFlags.HideImpliedDirectories })
            .addOption('-b, --escape', 'Print C-style escapes for nongraphic characters', { name: 'showEscapes', bitflag: 'displayFlags', sets: DisplayFlags.ShowEscapes })
            .addOption('-B, --ignore-backups', 'Do not list implied entries ending with ~', { name: 'ignoreBackups', bitflag: 'displayFlags', sets: DisplayFlags.HideBackups })
            .addOption('-c, --change-time', 'With -lt: sort by, and show, ctime (time of last modification of file status information); with -l: show ctime and sort by  name; otherwise: sort by ctime, newest first', { name: 'sortByCTime', setv: 'SORTBY', value: SortBy.CTime })
            .addOption('-C, --columns', 'List entries by columns', { name: 'showColumns', setv: 'FORMAT', value: 'across' })
            .addOption('--color <COLORWHEN:always|always|auto|never>', `Colorize  the output; COLORWHEN can be 'always' (default if omitted), 'auto', or 'never'`, { name: 'colorWhen' })
            .addOption('-d, --directory', 'List directories themselves, not their contents', { name: 'listDirectoriesOnly', bitflag: 'displayFlags', sets: DisplayFlags.ShowDirectoriesOnly })
            .addOption('-f', 'Do not sort (ignored); Enables -a', { name: 'nosort', bitflag: 'displayFlags', sets: DisplayFlags.ShowAll })
            .addOption('--format <FORMAT|across|commas|horizontal|long|singlecolumn|verbose|vertical>?', 'Set display format', { name: 'displayFormat' })
            .addOption('-g, --no-owner', 'Do not list owner', { name: 'noOwner', bitflag: 'displayFlags', sets: DisplayFlags.HideOwner })
            .addOption('-G, --no-group', 'Do not print group names', { name: 'noGroup', bitflag: 'displayFlags', sets: DisplayFlags.HideGroup })
            .addOption('-h, --human-readable', 'Print sizes like 1Kb, 234Mb, 3.2Gb, etc', { name: 'humanSizes', bitflag: 'displayFlags', sets: DisplayFlags.ShowHumanSize })
            .addOption('-i, --inode', 'Print the index number of each file', { name: 'showInode', bitflag: 'displayFlags', sets: DisplayFlags.ShowInode })
            .addOption('-I, --ignore=<IGNORE>?', 'Do not list implied entries matching IGNORE pattern', { name: 'ignorePattern' })
            .addOption('-l', 'Use the long listing format', { name: 'longListing', setv: 'FORMAT', value: DisplayFormats.long })
            .addOption('-m', 'fill width with a comma separated list of entries', { name: 'commaListing', setv: 'FORMAT', value: DisplayFormats.commas })
            .addOption('-N, --literal', 'Print entry names without quoting', { name: 'literalFiles', bitflag: 'displayFlags', clears: DisplayFlags.QuoteNames })
            .addOption('-p', 'Append slash character to directories', { name: 'appendDirSlash', bitflag: 'displayFlags', sets: DisplayFlags.AppendDirectorySlash })
            .addOption('-Q, --quote-name', 'Enclose entry names in double quotes', { name: 'quoteNames', bitflag: 'displayFlags', sets: DisplayFlags.QuoteNames })
            .addOption('-r, --reverse', 'Reverse order while sorting', { name: 'reverseSort', setv: 'SORTORDER', value: SortOrder.Descending })
            .addOption('-R, --recursive', 'List subdirectories recursively', { name: 'recursive', sets: LS_OPT_RECURSIVE })
            .addOption('-s, --size', 'Print the allocated size of each file', { name: 'showSize', bitflag: 'displayFlags', sets: DisplayFlags.ShowSize })
            .addOption('-S', 'Sort by file size, largest first', { name: 'sortBySize', setv: 'SORTBY', value: SortBy.Size })
            .addOption('--sort <SORTBY|none|size|time|version|extension>?', 'Sort by SORTBY instead of name: none (-U), size (-S), time (-t), version(-v), extension(-X) ', { name: 'sortBy' })
            .addOption('-X', 'Sort alphabetically by entry extension', { name: 'sortByExtension', setv: 'SORTBY', value: SortBy.Extension })
            .addOption('-1', 'List one file per line', { name: 'showSingleColumn', setv: 'FORMAT', value: DisplayFormats.singleColumn })
            .addArgument('<FILE(S)...?>')
            .addFiller('FILES', () => {
                if (objin) {
                    let results = [];
                    for (const ob of objin) {
                        let filename = typeof ob === 'string' ? ob : ob.fullPath;
                        if (results.findIndex(f => f === filename) === -1)
                            results.push(filename);
                    }
                    return results;
                }
                if (stdin)
                    return stdin.readLines();
                return undefined;
            })
            .complete();
    }

    /**
     * Gather file information
     * 
     * @param {string} verb 
     * @param {Object.<string,{ display:string, entry:object, files: { display: string, entry: object }[] }} dirs The data structure to populate
     * @param {LsOptions} options Options from the command line
     * @param {string} cwd The current working directory
     * @param {string} file The file to put into the dirs object
     */
    private async getFiles(verb, dirs, options, cwd, file) {
        try {
            let resolvedFilename = efuns.resolvePath(file, cwd),
                fo = await efuns.fs.getObjectAsync(resolvedFilename);

            if (fo.isDirectory) {
                if (fo.fullPath in dirs === false)
                    dirs[fo.fullPath] = {
                        display: file,
                        entry: fo,
                        files: (await fo.readDirectoryAsync()).map(fo => { return { display: efuns.joinPath(file, fo.name), entry: fo }; })
                    };

                if (options.listingFlags & LS_OPT_RECURSIVE) {
                    for (const subdir of dirs[fo.fullPath].files) {
                        if (subdir.isDirectory) {
                            let displayPath = efuns.joinPath(file, subdir.name);
                            await this.getFiles(dirs, options, cwd, displayPath);
                        }
                    }
                }
            }
            else if (fo.isFile) {
                if ('' in dirs === false) {
                    dirs[''] = { display: '', files: [] };
                }
                dirs[''].files.push({ display: file, entry: fo });
            }
            else if (!fo.exists) {
                errorLine(`${verb}: ${file}: No such file or directory`);
            }
        }
        catch (err) {
            errorLine(`${verb}: Error: ${err}`);
        }
    }

    override async cmd(text, cmdline) {
        /** @type {LsOptions} */
        let options = await this.command.parse(cmdline);

        if (typeof options !== 'object')
            return options;

        if (options.FILES.length === 0)
            options.FILES.push(ENV.CWD);

        /** @type {LsDirCollection}>*/
        let dirs = {};
        let cwd = ENV.CWD;

        for (const file of options.FILES) {
            await this.getFiles(cmdline.verb, dirs, options, cwd, file);
        }

        let dirNames = Object.keys(dirs).filter(s => s.length > 0);

        if (options.SORTORDER == SortOrder.Descending) {
            dirNames = dirNames.reverse();
        }

        switch (options.FORMAT) {
            case DisplayFormats.commas:
                return await this.displayCommaFormat(dirNames, options, dirs);

            case DisplayFormats.long:
                break;

            case DisplayFormats.singleColumn:
                break;

            case DisplayFormats.across:
            default:
                break;

        }
        return true;
    }

    /**
     * Filter files and sort them
     * @param {LsOptions} options
     * @param {LsDirEntry[]} files
     */
    private applyFilterAndSort(options, files) {
        if ((options.displayFlags & DisplayFlags.ShowAll) === 0) {
            files = files.filter(f => f.entry.name.charAt(0) !== '.');
        }
        if (options.displayFlags & DisplayFlags.HideBackups) {
            files = files.filter(f => !f.entry.name.endsWith('~'));
        }
        files.sort((a, b) => {
            let _a = a.entry[options.SORTBY],
                _b = b.entry[options.SORTBY];

            if (_a < _b)
                return -1;
            else if (_b < _a)
                return 1;
            else
                return 0;
        });

        if (options.SORTORDER === SortOrder.Descending)
            files = files.reverse();

        files.forEach(f => {
            if (options.COLORWHEN !== 'never') {
                if (f.entry.isDirectory) {
                    f.display = '%^BLUE%^%^BOLD%^' + f.display + '%^RESET%^';
                }
                else if (f.entry.isLoaded) {
                    f.display = '%^CYAN%^%^BOLD%^' + f.display + '%^RESET%^';
                }
            }
            if (f.entry.isDirectory && (options.displayFlags & DisplayFlags.AppendDirectorySlash)) {
                if (!f.display.endsWith('/'))
                    f.display += '/';
            }
            efuns.addOutputObject(f.entry);
        });


        return files;
    }

    /**
     * 
     * @param {string[]} dirNames
     * @param {LsOptions} options
     * @param {LsDirCollection} dirs
     * @returns {Promise<boolean>}
     */
    private async displayCommaFormat(dirNames, options, dirs) {
        let nodir = dirs[''],
            width = ENV.COLUMNS || 80,
            display = '';

        if (nodir) {
            let files = this.applyFilterAndSort(options, nodir.files),
                content = files.map(f => f.display).join(', ') + '\n';

            display += efuns.wrapText(content, width);
        }
        for (const dirName of dirNames) {
            efuns.addOutputObject(dirs[dirName].display);
            let dir = dirs[dirName],
                files = this.applyFilterAndSort(options, dir.files),
                content = files.map(f => f.display).join(', ') + '\n';

            display += `\n${dir.display}:\n`;
            display += efuns.wrapText(content, width);
        }
        if (display)
            return writeLine(display);
        else
            return false;
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
}
