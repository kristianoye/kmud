MUD.include('Base');

MUD.imports(LIB_COMMAND, 'async');

const
    LS_OPT_LONGFORMAT = 1 << 0,
    LS_OPT_SHOWSIZE = 1 << 1,
    LS_OPT_SINGLECOL = 1 << 2,
    LS_OPT_COLFORMAT = 1 << 3;

class Ls extends Command {
    /**
     * 
     * @param {string[]} args
     * @param {MUDInputEvent} cmdline
     */
    cmd(args, cmdline) {
        var player = thisPlayer,
            getDirFlags = GetDirFlags.Defaults,
            displayFlags = LS_OPT_COLFORMAT,
            dir = player.workingDirectory;

        for (var i = 0; i < args.length; i++) {
            var opt = args[i];
            if (opt.startsWith('--')) {
                switch (opt.slice(3).toLowerCase()) {
                    case 'long':

                }
            }
            else if (opt.startsWith('-')) {
                let optList = opt.slice(1).split('');
                for (var i in optList) {
                    switch (optList[i]) {
                        case 'l':
                            getDirFlags |= GetDirFlags.Details;
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
                        default:
                            return `ls: unknown option: -${optList[i]}`;
                    }
                }
            }
            switch (opt) {
                case '-l': case '--long': getDirFlags |= GetDirFlags.Details; break;
                case '-a': case '--all': getDirFlags |= GetDirFlags.Hidden; break;
                case '-p': case '--perms': flag |= GetDirFlags.Perms; break;
                case '-t': case '--text': getDirFlags |= LS_OPT_PLAINTEXT; break;

                default:
                    if (opt.startsWith('-')) {
                        return `Unknown option: ${opt}`;
                    }
                    else {
                        dir = efuns.resolvePath(opt, dir);
                    }
            }
        }

        if (thisPlayer.hasBrowser && (getDirFlags & LS_OPT_PLAINTEXT) !== LS_OPT_PLAINTEXT) {
            return this.webListing(dir, thisPlayer);
        }

        var files = efuns.getDir(dir);

        if (getDirFlags > 0 && false) {

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

MUD.export(Ls);
