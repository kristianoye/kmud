/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_SHELLCMD } from '@Base';
import ShellCommand from LIB_SHELLCMD;

const
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

/**
 * The LS command
 */
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
            .addOption('-1, --one', 'List one file per line', { name: 'showSingleColumn', setv: 'FORMAT', value: DisplayFormats.singleColumn })
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
                        files: (await fo.readDirectoryAsync()).map(fo => { return { display: fo.name, entry: fo }; })
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

    /**
     * Execute the listing command
     * @param {string} text
     * @param {{ args: string[], verb: string }} cmdline
     * @returns
     */
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
                return await this.displayLongFormat(dirNames, options, dirs);

            case DisplayFormats.singleColumn:
                return await this.displaySingleColumnFormat(dirNames, options, dirs);

            case DisplayFormats.across:
            default:
                return await this.displayColumnFormat(dirNames, options, dirs);

        }
        return true;
    }

    /**
     * Filter files and sort them
     * @param {LsOptions} options
     * @param {LsDirEntry[]} files
     */
    private async applyFilterAndSort(options, files) {
        const getColor = (v) => {
            let lookup = Object.assign({
                DIR: 'BOLD+BLUE',
                EXE: 'GREEN',
                EXELOADED: 'BOLD+GREEN',
                OBJ: 'CYAN',
                OBJLOADED: 'BOLD+CYAN'
            }, ENV.DIRCOLORS || {});

            if (v in lookup)
                return lookup[v].split('+').map(c => `%^${c.trim()}%^`).join('');
            else
                return '';
        };

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

        for (let f of files) {
            if (options.COLORWHEN !== 'never') {
                if (f.entry.isDirectory) {
                    let color = getColor('DIR');
                    f.display = color + f.display + '%^RESET%^';
                }
                else if (f.entry.isLoaded) {
                    let color = getColor('OBJLOADED');
                    f.display = color + f.display + '%^RESET%^';
                }
            }
            if (f.entry.isDirectory && (options.displayFlags & DisplayFlags.AppendDirectorySlash)) {
                if (!f.display.endsWith('/'))
                    f.display += '/';
            }
            if (options.displayFlags & DisplayFlags.ShowInode) {
                f.inode = f.entry.ino;
                files.inodeLen = Math.max(files.inodeLen || 0, f.inode.toString().length);
            }
            if (options.displayFlags & DisplayFlags.ShowSize) {
                if (f.entry.size < f.entry.blksize)
                    f.size = f.entry.blksize;
                else
                    f.size = f.entry.size;
                files.sizeLen = Math.max(files.sizeLen || 0, f.size.toString().length);
                if (options.displayFlags & DisplayFlags.ShowHumanSize) {
                    f.humanSize = efuns.getMemSizeString(f.size);
                    files.humanSizeLen = Math.max(files.humanSizeLen || 0, f.humanSize.length);
                }
            }
            if (options.FORMAT === 'long') {
                f.permString = await f.entry.getPermString();
                if ((options.displayFlags & DisplayFlags.HideOwner) === 0) {
                    f.owner = await f.entry.getOwnerName();
                    files.ownerLen = Math.max(files.ownerLen || 0, f.owner.length);
                }
                if ((options.displayFlags & DisplayFlags.HideGroup) === 0) {
                    f.group = await f.entry.getGroupName();
                    files.groupLen = Math.max(files.groupLen || 0, f.group.length);
                }
            }
            efuns.addOutputObject(f.entry);
        }
        return files;
    }

    /**
     * Display files in comma-delimited list
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
            let files = await this.applyFilterAndSort(options, nodir.files),
                content = files.map(f => {
                    let entry = [];
                    if (f.inode)
                        entry.push(f.inode);
                    if (f.humanSize)
                        entry.push(f.humanSize)
                    else if (f.size)
                        entry.push(f.size);
                    entry.push(f.display);
                    return entry.join(' ');
                }).join(', ') + '\n';

            display += efuns.wrapText(content, width);
        }
        for (const dirName of dirNames) {
            if (display) display += '\n';
            efuns.addOutputObject(dirs[dirName].display);
            let dir = dirs[dirName],
                files = await this.applyFilterAndSort(options, dir.files),
                content = files.map(f => {
                    let entry = [];
                    if (f.inode)
                        entry.push(f.inode);
                    if (f.humanSize)
                        entry.push(f.humanSize)
                    else if (f.size)
                        entry.push(f.size);
                    entry.push(f.display);
                    return entry.join(' ');
                }).join(', ') + '\n';

            if (nodir || dirNames.length > 0)
                display += `\n${dir.display}:\n`;
            display += efuns.wrapText(content, width);
        }
        if (display)
            return writeLine(display);
        else
            return false;
    }

    /**
     * Display files in columns
     * @param {string[]} dirNames
     * @param {LsOptions} options
     * @param {LsDirCollection} dirs
     * @returns {Promise<boolean>}
     */
    async displayColumnFormat(dirNames, options, dirs) {
        let nodir = dirs[''],
            width = ENV.COLUMNS || 80,
            display = '';

        if (nodir) {
            let files = await this.applyFilterAndSort(options, nodir.files),
                content = files.map(f => {
                    let entry = [];
                    if (f.inode)
                        entry.push(`{0,-${files.inodeLen}}`.fs(f.inode));
                    if (f.humanSize)
                        entry.push(`{0,-${files.humanSizeLen}}`.fs(f.humanSize));
                    else if (f.size)
                        entry.push(`{0,-${files.sizeLen}}`.fs(f.size));
                    entry.push(f.display);
                    return entry.join(' ');
                });

            display += efuns.columnText(content, width);
        }
        for (const dirName of dirNames) {
            if (display) display += '\n';
            efuns.addOutputObject(dirs[dirName].display);
            let dir = dirs[dirName],
                files = await this.applyFilterAndSort(options, dir.files),
                content = files.map(f => {
                    let entry = [];
                    if (f.inode)
                        entry.push(`{0,-${files.inodeLen}}`.fs(f.inode));
                    if (f.humanSize)
                        entry.push(`{0,-${files.humanSizeLen}}`.fs(f.humanSize));
                    else if (f.size)
                        entry.push(`{0,-${files.sizeLen}}`.fs(f.size));
                    entry.push(f.display);
                    return entry.join(' ');
                });

            if (nodir || dirNames.length > 0)
                display += `\n${dir.display}:\n`;
            display += efuns.columnText(content, width);
        }
        if (display)
            return writeLine(display);
        else
            return false;
    }

    /**
     * Display files in long/details format
     * @param {string[]} dirNames
     * @param {LsOptions} options
     * @param {LsDirCollection} dirs
     * @returns {Promise<boolean>}
     */
    async displayLongFormat(dirNames, options, dirs) {
        let nodir = dirs[''],
            display = '';

        if (nodir) {
            let files = await this.applyFilterAndSort(options, nodir.files),
                content = files.map(f => {
                    let entry = [];
                    if (f.inode)
                        entry.push(`{0,-${files.inodeLen}}`.fs(f.inode));
                    if (f.permString)
                        entry.push(`{0,-12}`.fs(f.permString));
                    if (f.owner)
                        entry.push(`{0,-${files.ownerLen}}`.fs(f.owner));
                    if (f.group)
                        entry.push(`{0,-${files.groupLen}}`.fs(f.group));
                    if (f.humanSize)
                        entry.push(`{0,-${files.humanSizeLen}}`.fs(f.humanSize));
                    else if (f.size)
                        entry.push(`{0,-${files.sizeLen}}`.fs(f.size));
                    entry.push(f.entry.ctime.toISOString().slice(0, 16));
                    entry.push(f.display);
                    return entry.join(' ');
                });

            display += content.join('\n');
        }
        for (const dirName of dirNames) {
            if (display) display += '\n';
            efuns.addOutputObject(dirs[dirName].display);
            let dir = dirs[dirName],
                files = await this.applyFilterAndSort(options, dir.files),
                content = files.map(f => {
                    let entry = [];
                    if (f.inode)
                        entry.push(`{0,-${files.inodeLen}}`.fs(f.inode));
                    if (f.permString)
                        entry.push(`{0,-12}`.fs(f.permString));
                    if (f.owner)
                        entry.push(`{0,-${files.ownerLen}}`.fs(f.owner));
                    if (f.group)
                        entry.push(`{0,-${files.groupLen}}`.fs(f.group));
                    if (f.humanSize)
                        entry.push(`{0,-${files.humanSizeLen}}`.fs(f.humanSize));
                    else if (f.size)
                        entry.push(`{0,-${files.sizeLen}}`.fs(f.size));
                    entry.push(f.entry.ctime.toISOString().slice(0, 16));
                    entry.push(f.display);
                    return entry.join(' ');
                });

            if (nodir || dirNames.length > 0)
                display += `\n${dir.display}:\n`;
            display += content.join('\n');
        }
        if (display)
            return writeLine(display);
        else
            return false;
    }

    /**
     * Display files in long/details format
     * @param {string[]} dirNames
     * @param {LsOptions} options
     * @param {LsDirCollection} dirs
     * @returns {Promise<boolean>}
     */
    async displaySingleColumnFormat(dirNames, options, dirs) {
        let nodir = dirs[''],
            display = '';

        if (nodir) {
            let files = await this.applyFilterAndSort(options, nodir.files),
                content = files.map(f => {
                    let entry = [];
                    if (f.inode)
                        entry.push(`{0,-${files.inodeLen}}`.fs(f.inode));
                    if (f.humanSize)
                        entry.push(`{0,-${files.humanSizeLen}}`.fs(f.humanSize));
                    else if (f.size)
                        entry.push(`{0,-${files.sizeLen}}`.fs(f.size));
                    entry.push(f.display);
                    return entry.join(' ');
                });

            display += content.join('\n');
        }
        for (const dirName of dirNames) {
            if (display) display += '\n';
            efuns.addOutputObject(dirs[dirName].display);
            let dir = dirs[dirName],
                files = await this.applyFilterAndSort(options, dir.files),
                content = files.map(f => {
                    let entry = [];
                    if (f.inode)
                        entry.push(`{0,-${files.inodeLen}}`.fs(f.inode));
                    if (f.humanSize)
                        entry.push(`{0,-${files.humanSizeLen}}`.fs(f.humanSize));
                    else if (f.size)
                        entry.push(`{0,-${files.sizeLen}}`.fs(f.size));
                    entry.push(f.display);
                    return entry.join(' ');
                });

            if (nodir || dirNames.length > 0)
                display += `\n${dir.display}:\n`;
            display += content.join('\n');
        }
        if (display)
            return writeLine(display);
        else
            return false;
    }
}
