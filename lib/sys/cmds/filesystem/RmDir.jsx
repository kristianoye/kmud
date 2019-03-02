/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Daemon = require('Daemon'),
    Command = require(Base.Command),
    RMDIR_VERBOSE = 1 << 0,
    RMDIR_PARENTS = 1 << 1;

class RmDir extends Command {
    create(ctx) {
        this.FileIndex = efuns.loadObjectSync(Daemon.FileIndex);
    }

    private get FileIndex() {
        return unwrap(get(efuns.loadObjectSync(Daemon.FileIndex)));
    }

    private set FileIndex(value) {
        set(value);
    }

    cmd(args, cmdline) {
        let player = thisPlayer,
            dirList = [],
            options = 0,
            flags = 0;

        for (let i = 0; i < args.length; i++) {
            let opt = args[i];

            if (opt.startsWith('-')) {
                let opts = opt.charAt(1) === '-' ? [opt] : opt.slice(1).split('');
                for (var j = 0; j < opts.length; j++) {
                    switch (opts[j]) {
                        case 'p': case '--parents':
                            flags |= MUDFS.MkdirFlags.EnsurePath;
                            break;
                        case 'v': case '--verbose':
                            options |= RMDIR_VERBOSE;
                            break;
                        default:
                            return `Rmdir: Unknown option: ${opts[j]}`;
                    }
                }
            }
            else {
                if (flags & MUDFS.MkdirFlags.EnsurePath) {
                    let parts = opt.split('/');
                    while (parts.length) {
                        dirList.push(efuns.resolvePath(parts.join('/'), player.workingDirectory));
                        parts.pop();
                    }
                }
                else
                    dirList.push(efuns.resolvePath(opt, player.workingDirectory));
            }
        }
        if (dirList.length === 0)
            return 'Rmdir: Missing parameter';
        this.removeDirectories(dirList, flags, options, cmdline);
        return cmdline.complete;
    }

    /**
     * Does the work of actually deleting the directories.
     * @param {string[]} dirList
     * @param {number} flags
     * @param {number} options
     * @param {MUDInputEvent} cmdline
     */
    removeDirectories(dirList, flags, options, cmdline) {
        let dir = dirList.shift();

        efuns.rmdir(dir, flags, (success, error) => {
            if (options & RMDIR_VERBOSE)
                writeLine('Rmdir: ' + (success ? `Removed ${dir}` : `Failed: ${error.message}`));
            if (dirList.length === 0) return cmdline.complete();
            else this.removeDirectories(dirList, flags, options, cmdline);
        });
    }
}

module.exports = new RmDir();
