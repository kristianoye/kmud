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
    MkdirVerbose = 1 << 0,
    MkdirParents = 1 << 1;

class MkDirCommand extends Command {
    /**
     * Create a directory
     * @param {string} cmdText The raw text for the command
     * @param {MUDInputEvent} cmdline The input event from the client
     */
    async cmd(cmdText, cmdline) {
        let player = thisPlayer(),
            args = cmdline.args,
            dirList = [],
            options = 0,
            flags = 0;

        for (let i = 0; i < args.length; i++) {
            let opt = args[i];

            if (opt.startsWith('-')) {
                let opts = opt.charAt(1) === '-' ? [opt] : opt.slice(1).split('');

                for (let j = 0, max = opts.length; j < max; j++) {
                    switch (opts[j]) {
                        case 'p': case '--parents':
                            flags |= DirFlags.EnsurePathExists;
                            break;

                        case 'v': case '--verbose':
                            options = options.setFlag(MkdirVerbose);
                            break;

                        case '--help':
                            return writeLine(
                                'Usage: mkdir[OPTION]...DIRECTORY...\n' +
                                'Create the DIRECTORY(ies), if they do not already exist.\n\n' +
                                'Mandatory arguments to long options are mandatory for short options too.\n' +
                                '   -m, --mode=MODE   set file mode (as in chmod), not a=rwx - umask\n' +
                                '   -p, --parents     no error if existing, make parent directories as needed\n' +
                                '   -v, --verbose     print a message for each created directory\n' +
                                '      --help     display this help and exit\n' +
                                '      --version  output version information and exit');
                            break;

                        case '--version':
                            return writeLine('mkdir (KMUD CoreUtil) v2.1; Written by Kristian Oye.');

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

            if (dir) {
                let result = await efuns.fs.createDirectoryAsync(dir, flags)
                    .catch(err => { throw err });

                if (options.hasFlag(MkdirVerbose))
                    writeLine('Mkdir: ' + (success ? `Created ${dir}` : `Failed: ${error.message}`));
            }
            if (dirList.length === 0)
                return true;
            else
                return await this.createDirectories(dirList, flags, options, cmdline);
        }
        catch (err) {
            writeLine(`MkDir error: ${err.message}`);
            return false;
        }
    }

    help() {
        return 'No help yet';
    }
}

module.exports = await createAsync(MkDirCommand);
