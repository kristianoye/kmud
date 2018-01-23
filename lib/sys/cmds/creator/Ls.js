const
    Command = require('../../../base/Command');

const
    LS_OPT_LONGFORMAT = 1 << 0, // Show output in long format
    LS_OPT_SHOWSIZE = 1 << 1,   // Include file size
    LS_OPT_SINGLECOL = 1 << 2,  // Show output in a single column
    LS_OPT_COLFORMAT = 1 << 3,  // Show output in columns
    LS_OPT_PLAINTEXT = 1 << 4;  // Do not display in Explorer

class LsCommand extends Command {
    /**
     * 
     * @param {string[]} args
     * @param {MUDInputEvent} cmdline
     */
    cmd(args, cmdline) {
        var player = thisPlayer,
            getDirFlags = GetDirFlags.Defaults | GetDirFlags.ImplicitDirs,
            displayFlags = LS_OPT_COLFORMAT,
            dirList = [];

        for (var i = 0; i < args.length; i++) {
            var opt = args[i];
            if (opt.startsWith('--')) {
                switch (opt.slice(3).toLowerCase()) {
                    case 'long':
                        getDirFlags |= GetDirFlags.Details;
                        displayFlags |= LS_OPT_LONGFORMAT;
                        break;
                }
            }
            else if (opt.startsWith('-')) {
                let optList = opt.slice(1).split('');
                for (let i = 0; i < optList.length; i++) {
                    switch (optList[i]) {
                        case 'l':
                            getDirFlags |= GetDirFlags.Details;
                            displayFlags |= LS_OPT_LONGFORMAT;
                            break;
                        case 's':
                            getDirFlags |= GetDirFlags.Size;
                            break;
                        case '1':
                            displayFlags |= LS_OPT_SINGLECOL;
                            break;
                        case 'p':
                            getDirFlags |= GetDirFlags.Perms;
                            break;
                        case 'a':
                            getDirFlags |= GetDirFlags.Hidden;
                            break;
                        case 'C':
                            displayFlags |= LS_OPT_COLFORMAT;
                            break;
                        case 'T':
                            displayFlags |= LS_OPT_PLAINTEXT;
                            break;
                        default:
                            return `ls: unknown option: -${optList[i]}`;
                    }
                }
            }
            else {
                dirList.push(efuns.resolvePath(args[i], thisPlayer.workingDirectory));
            }
            if (dirList.length === 0)
                dirList.push(player.workingDirectory || '/');
        }
        if (thisPlayer.hasBrowser && (getDirFlags & LS_OPT_PLAINTEXT) !== LS_OPT_PLAINTEXT) {
            return this.webListing(dirList[0], thisPlayer);
        }
        dirList.map((dir, i) => {
            var files = efuns.getDir(dir, getDirFlags, (files, err) => {
                let l = files.length;
            });
            //if (displayFlags & LS_OPT_SINGLECOL)
            //    return this.displaySingleColumn(dir, displayFlags, getDirFlags);
            //else if (displayFlags & LS_OPT_COLFORMAT)
            //    return this.displayColumnListing(dir, displayFlags, getDirFlags);
            //else
            //    return this.displayLongListing(dir, displayFlags, getDirFlags);
        });
        return true;
    }

    displayColumnListing(dir, displayFlags, getDirFlags) {
        var files = efuns.getDir(dir, getDirFlags);
        if (displayFlags & LS_OPT_SINGLECOL) {
            thisPlayer.writeLine(files.join('\n'));
            return true;
        }
        else if (displayFlags & LS_OPT_COLFORMAT) {

        }
        else if (getDirFlags > 0 && false) {

            var lines = files.map(a => efuns.sprintf('%-20s%-12s%1s%18s%5s',
                a[0],
                (function (x) {
                    switch (x) {
                        case -2:
                            return '[directory]';

                        default:
                            return efuns.getMemSizeString(x);
                    }
                })(a[1]),
                new Date(a[3]).toDateString(),
                new Date(a[2]).toDateString(),
                master().getAccessText(thisPlayer, dir + '/' + a[0])
            ));

            thisPlayer.writeLine(lines.join('\n'));
        }
        else {
            write(efuns.columnText(files));
        }
        return true;
    }

    displayLongListing(dir, displayFlags, getDirFlags) {
    }

    /**
     * List a directory in a single column format.
     * @param {any} dir
     * @param {any} displayFlags
     * @param {any} getDirFlags
     */
    displaySingleColumn(dir, displayFlags, getDirFlags) {

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
