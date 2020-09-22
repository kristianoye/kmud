/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command),
    DirFlags = system.flags.fs.DirFlags;

const
    MKDIR_VERBOSE = 1 << 0,
    MKDIR_PARENTS = 1 << 1;

class MkDirCommand extends Command {
    /**
     * Create a directory
     * @param {string[]} args
     * @param {MUDInputEvent} cmdline
     */
    async cmd(args, cmdline) {
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
                            flags |= DirFlags.EnsurePathExists;
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

        await this.createDirectories(dirList, flags, options, cmdline);
        return true;
    }

    /**
     * 
     * @param {string[]} dirList A list of directories waiting to be created
     * @param {number} flags Flags controlling the operation
     * @param {number} options Options controlling output 
     * @param {MUDInputEvent} cmdline The command line options sent by the user
     */
    private async createDirectories(dirList, flags, options, cmdline) {
        try {
            let dir = dirList.shift();

            let result = await efuns.fs.createDirectoryAsync(dir, flags)
                .catch(err => { throw err });

            if (options & MKDIR_VERBOSE)
                writeLine('Mkdir: ' + (success ? `Created ${dir}` : `Failed: ${error.message}`));
            if (dirList.length === 0)
                return cmdline.complete();
            else
                return await this.createDirectories(dirList, flags, options, cmdline);
        }
        catch (err) {
            writeLine(`MkDir error: ${err.message}`);
            return cmdline.complete;
        }
    }

    help() {
        return 'No help yet';
    }
}

module.exports = await createAsync(MkDirCommand);
