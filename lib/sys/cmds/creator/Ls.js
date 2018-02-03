/*
 * Part of the Emerald MUDLib
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
MUD.include('Base');

const
    Command = require(LIB_COMMAND);

const
    LS_OPT_LONGFORMAT = 1 << 0, // Show output in long format
    LS_OPT_SHOWSIZE = 1 << 1,   // Include file size
    LS_OPT_SINGLECOL = 1 << 2,  // Show output in a single column
    LS_OPT_COLFORMAT = 1 << 3,  // Show output in columns
    LS_OPT_PLAINTEXT = 1 << 4,  // Do not display in Explorer
    LS_OPT_COLOR = 1 << 5,      // Show colors
    LS_OPT_CLASSIFY = 1 << 6;   // Append classification for file types (e.g. / for directories)

class LsCommand extends Command {
    /**
     * List files on the filesystem.
     * @param {string[]} args
     * @param {MUDInputEvent} cmdline
     */
    cmd(args, cmdline) {
        var player = thisPlayer,
            getDirFlags = 0,
            displayFlags = 0,
            dirList = [];

        for (var i = 0; i < args.length; i++) {
            var opt = args[i];
            if (opt.startsWith('-')) {
                let optList = opt.charAt(1) === '-' ? [opt] : opt.slice(1).split('');
                for (let j = 0; j < optList.length; j++) {
                    switch (optList[j]) {
                        case 'a':
                            getDirFlags |= GetDirFlags.Hidden;
                            break;

                        case '--color':
                            displayFlags |= LS_OPT_COLOR;
                            break;

                        case 'd':
                            getDirFlags |= GetDirFlags.Dirs;
                            break;

                        case 'l': case '--long':
                            getDirFlags |= GetDirFlags.Details;
                            displayFlags |= LS_OPT_LONGFORMAT;
                            break;

                        case 'p':
                            getDirFlags |= GetDirFlags.Perms;
                            break;

                        case 's':
                            getDirFlags |= GetDirFlags.Size;
                            displayFlags |= LS_OPT_SHOWSIZE;
                            break;

                        case '1':
                            displayFlags |= LS_OPT_SINGLECOL;
                            break;

                        case 'C':
                            displayFlags |= LS_OPT_COLFORMAT;
                            break;

                        case 'F':
                            displayFlags |= LS_OPT_CLASSIFY;
                            break;

                        case 'P':
                            getDirFlags |= GetDirFlags.Files;
                            break;

                        case 'T':
                            displayFlags |= LS_OPT_PLAINTEXT;
                            break;

                        default:
                            return `ls: unknown option: -${optList[j]}`;
                    }
                }
            }
            else {
                dirList.push(efuns.resolvePath(args[i], thisPlayer.workingDirectory));
            }
        }
        if (getDirFlags === 0)
            getDirFlags = GetDirFlags.Defaults;
        if ((getDirFlags & (GetDirFlags.Files | GetDirFlags.Dirs)) === 0)
            getDirFlags |= GetDirFlags.Files | GetDirFlags.Dirs;

        if (displayFlags === 0)
            displayFlags = LS_OPT_COLOR | LS_OPT_CLASSIFY | LS_OPT_COLFORMAT;

        if (dirList.length === 0)
            dirList.push(player.workingDirectory || '/');

        if (thisPlayer.hasBrowser && (displayFlags & LS_OPT_PLAINTEXT) !== LS_OPT_PLAINTEXT) {
            return this.webListing(dirList[0], thisPlayer);
        }
        let results = Array(dirList.length),
            completed = 0;

        dirList.forEach((dir, i) => {
            efuns.getDir(dir, getDirFlags, (files, err) => {
                results[i] = files || err;
                if (++completed === dirList.length)
                    this.display(dirList, results, displayFlags, cmdline);
            });
        });

        //  Indicate the command is async
        return cmdline.complete;
    }

    /**
     * Display the listing information to the user.
     * @param {string[]} dirList The list of directories requested.
     * @param {FileSystemStat[][]} results The results from the filesystem.
     * @param {number} displayFlags The flags controlling the display of information.
     * @param {MUDInputEvent} cmdline The original command line data.
     */
    display(dirList, results, displayFlags, cmdline) {
        for (let i = 0, max = results.length; i < max; i++) {
            let dir = results[i];

            if (displayFlags & LS_OPT_LONGFORMAT)
                this.displayLongListing(dirList[i], results[i], displayFlags, max > 1);
            else if (displayFlags & LS_OPT_SINGLECOL)
                this.displaySingleColumn(dirList[i], results[i], displayFlags, max > 1);
            else
                this.displayColumnListing(dirList[i], results[i], displayFlags, max > 1);
        }
        cmdline.complete();
    }

    /**
     * List a directory in a single column format.
     * @param {string} dir
     * @param {FileSystemStat[]} files
     * @param {number} displayFlags
     * @param {boolean} showDirName
     */
    displayColumnListing(dir, files, displayFlags, showDirName) {
        let buffer = '', total = 0;
        if (showDirName) buffer += `\n${dir}:\n`;
        if (!Array.isArray(files)) {
            buffer += `Error: ${dir}: ${files}`;
        }
        else {
            buffer += efuns.columnText(files.map(fi => {
                let result = '';
                if (displayFlags & LS_OPT_SHOWSIZE)
                    result += efuns.sprintf('%-3s ', fi.size < 0 ? '0' : Math.floor(fi.size / 1024) || '1');
                result += this.displayColumnName(fi, displayFlags);
                return result;
            }));
        }
        write(buffer);
    }

    /**
     * 
     * @param {string} dir
     * @param {FileSystemStat[]} files
     * @param {number} displayFlags
     * @param {boolean} showDirName
     */
    displayLongListing(dir, files, displayFlags, showDirName) {
        let buffer = '', total = 0;
        if (showDirName) buffer += `\n${dir}:\n`;
        files.forEach(fi => {
            buffer += efuns.sprintf('%5s %10s %10s %10s %-18s',
                master().getAccessText(thisPlayer, dir + '/' + fi.name),
                'owner',
                'group',
                (fi.size === -2) ? '[DIR]' : efuns.getMemSizeString(fi.size),
                fi.mtime.toISOString().slice(0, 16))
                + this.displayColumnName(fi, displayFlags) + '\n';
        });
        write(buffer);
    }

    /**
     * 
     * @param {FileSystemStat} fi
     * @param {number} flags
     */
    displayColumnName(fi, flags) {
        let result = fi.name;
        if (flags & LS_OPT_COLOR) {
            if (fi.isDirectory) {
                result = "%^BLUE%^%^BOLD%^" + result + "%^RESET%^";
            }
            else if (efuns.findObject(fi.parent + '/' + fi.name)) {
                result = "%^GREEN%^%^BOLD%^" + result + "%^RESET%^";
            }
            else if (fi.name.endsWith('.js')) {
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
        write(buffer);
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
            efuns.getDir(dir, 1, (files, err) => {
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
                eventType: 'kmud.wizShell.dir',
                eventData: {
                    result: result,
                    title: path
                }
            });
        });
        return true;
    }

    help() {

    }
}

module.exports = LsCommand;
