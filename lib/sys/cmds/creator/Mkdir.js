/*
 * Part of the Emerald MUDLib
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
MUD.include('Base');

const
    MKDIR_VERBOSE = 1 << 0,
    MKDIR_PARENTS = 1 << 1,
    Command = require(LIB_COMMAND);

class MkDir extends Command {
    create(ctx) {
        this.FileIndex = efuns.loadObject('/sys/daemon/FileIndex');
    }

    /**
     * Create a directory
     * @param {string[]} args
     * @param {MUDInputEvent} cmdline
     */
    cmd(args, cmdline) {
        let player = thisPlayer,
            dir = efuns.resolvePath(args[0], player.workingDirectory),
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
                            flags |= MkdirFlags.EnsurePath;
                            break;
                        case 'v': case '--verbose':
                            options |= MKDIR_VERBOSE;
                            break;
                        default:
                            return `Mkdir: Unknown option: ${opts[j]}`;
                    }
                }
            }
            else
                dirList.push(efuns.resolvePath(opt, player.workingDirectory));
        }
        if (dirList.length === 0)
            return 'Mkdir: Missing parameter';

        let rc = dirList.length,
            fullList = [];

        dirList.forEach(dir => {
            let parts = dir.split('/'),
                dirpath = '';
            while (parts.length) {
                dirpath += parts.shift() + '/';
                fullList.push(dirpath);
            }
        });
        this.createDirectories(fullList, flags, options, cmdline);
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
                write('Mkdir: ' + (success ? `Created ${dir}` : `Failed: ${error.message}`));
            if (dirList.length === 0) return cmdline.complete();
            else this.createDirectories(dirList, flags, options, cmdline);
        });
    }

    help() {

    }
}

module.exports = MkDir;
