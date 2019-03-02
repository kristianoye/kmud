/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

const
    MKDIR_VERBOSE = 1 << 0,
    MKDIR_PARENTS = 1 << 1;

class MkDirCommand extends Command {

    private get FileIndex() {
        return unwrap(get(efuns.loadObjectSync(Daemon.FileIndex)));
    }

    private set FileIndex(value) {
        set(value);
    }

    /**
     * Create a directory
     * @param {string[]} args
     * @param {MUDInputEvent} cmdline
     */
    cmd(args, cmdline) {
        let player = thisPlayer,
            dirList = [],
            options = 0,
            flags = 0;

        for (let i = 0; i < args.length; i++) {
            let opt = args[i];

            if (opt.startsWith('-')) {
                let opts = opt.charAt(1)==='-' ? [opt] : opt.slice(1).split('');
                for (var j = 0; j < opts.length; j++) {
                    switch (opts[j]) {
                        case 'p': case '--parents':
                            flags |= MUDFS.MkdirFlags.EnsurePath;
                            break;
                        case 'v': case '--verbose':
                            options |= MKDIR_VERBOSE;
                            break;
                        default:
                            return `Mkdir: Unknown option: ${opts[j]}`;
                    }
                }
            }
            else {
                if (flags & MUDFS.MkdirFlags.EnsurePath) {
                    let parts = opt.split('/'), dir = [];
                    while (parts.length) {
                        dir.push(parts.shift());
                        dirList.push(efuns.resolvePath(dir.join('/'), player.workingDirectory));
                    }
                }
                else
                    dirList.push(efuns.resolvePath(opt, player.workingDirectory));
            }
        }
        if (dirList.length === 0)
            return 'Mkdir: Missing parameter';
        this.createDirectories(dirList, flags, options, cmdline);
        return cmdline.complete;
    }

    /**
     * 
     * @param {string[]} dirList
     * @param {number} flags
     * @param {number} options
     * @param {MUDInputEvent} cmdline
     */
    createDirectories(dirList, flags, options, cmdline) {
        let dir = dirList.shift();

        efuns.mkdir(dir, flags, (success, error) => {
            if (options & MKDIR_VERBOSE)
                writeLine('Mkdir: ' + (success ? `Created ${dir}` : `Failed: ${error.message}`));
            if (dirList.length === 0) return cmdline.complete();
            else this.createDirectories(dirList, flags, options, cmdline);
        });
    }

    help() {

    }
}

module.exports = new MkDirCommand();
