MUD.include('Base');

MUD.imports(LIB_COMMAND, 'async');

const
    LS_OPT_DETAILS = 1 << 0,
    LS_OPT_HIDDEN = 1 << 1,
    LS_OPT_SHOW_LOADED = 1 << 2,
    LS_OPT_SHOW_PERMISSIONS = 1 << 3,
    LS_OPT_PLAINTEXT = 1 << 4;

class Ls extends Command {
    cmd(args, cmdline) {
        var player = thisPlayer,
            flags = 0,
            dir = player.workingDirectory;

        for (var i = 0; i < args.length; i++) {
            var opt = args[i];
            switch (opt) {
                case '-l': case '--long': flags |= LS_OPT_DETAILS; break;
                case '-a': case '--all': flags |= LS_OPT_HIDDEN; break;
                case '-p': case '--perms': flag |= LS_OPT_SHOW_PERMISSIONS | LS_OPT_DETAILS; break;
                case '-t': case '--text': flags |= LS_OPT_PLAINTEXT; break;

                default:
                    if (opt.startsWith('-')) {
                        player.writeLine(`Unknown option: ${opt}`);
                        return -1;
                    }
                    else {
                        dir = efuns.resolvePath(opt, dir);
                    }
            }
        }

        if (thisPlayer.hasBrowser && (flags & LS_OPT_PLAINTEXT) !== LS_OPT_PLAINTEXT) {
            return this.webListing(dir, thisPlayer);
        }

        var files = efuns.getDir(dir, flags);

        if (flags > 0) {

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
                master().getAccessText(efuns, dir + '/' + a[0])
            ));

            thisPlayer.writeLine(lines.join('\n'));
        }
        else {
            var longest = 0, columnCount, rows = [], row = [];
            files.forEach((s) => { if (s.length > longest) longest = s.length; });
            longest += 3;
            columnCount = Math.ceil(thisPlayer.client.width / longest) - 1;
            files.forEach((s) => {
                row.push(s);
                if (row.length === columnCount) {
                    rows.push(row.map((fn) => { return efuns.sprintf('%-' + longest + 's', fn); }).join('  '));
                    row = [];
                }
            });
            if (row.length > 0) {
                rows.push(row.map((fn) => { return efuns.sprintf('%-' + longest + 's', fn); }).join('  '));
            }
            thisPlayer.writeLine(rows.join('\n'));
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
