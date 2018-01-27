MUD.include('Base');

const
    Command = require(LIB_COMMAND);

const
    RM_OPT_INTERACTIVE = 1 << 0,
    RM_OPT_RMEMPTYDIRS = 1 << 1,
    RM_OPT_SMARTPROMPT = 1 << 2,
    RM_OPT_RECURSIVE = 1 << 3,
    RM_OPT_VERBOSE = 1 << 4;

/**
 * Removes files from the filesystem.
 */
class RmCommand extends Command {
    /**
     * 
     * @param {string[]} args
     * @param {MUDInputEvent} evt
     */
    cmd(args, evt) {
        let flags = 0, fileList = [];
            
        for (let i = 0; i < args.length; i++) {
            let opt = args[i];

            if (opt.startsWith('-')) {
                let opts = opt.charAt(1) === '-' ? [opt] : opt.slice(1).split('');
                for (let j = 0; j < opts.length; j++) {
                    switch (opts[j]) {
                        case 'd': case '--dirs': case '--dir':
                            flags |= RM_OPT_RMEMPTYDIRS;
                            break;

                        case 'f': case '--force':
                            flags &= ~RM_OPT_INTERACTIVE;
                            break;

                        case 'i': case '--prompt':
                            flags |= RM_OPT_INTERACTIVE;
                            break;

                        case 'I':
                            flags |= RM_OPT_SMARTPROMPT;
                            break;

                        case 'r': case 'R': case '--recursive':
                            flags |= RM_OPT_RECURSIVE;
                            break;

                        case 'v': case '--verbose':
                            flags |= RM_OPT_VERBOSE;
                            break;

                        case '--':
                            if (++i < args.length)
                                fileList.push(efuns.resolvePath(args[i], thisPlayer.workingDirectory));
                            break;

                        default:
                            return `Mkdir: Unknown option: ${opts[j]}`;
                    }
                }
            }
            else {
                fileList.push(efuns.resolvePath(opt, thisPlayer.workingDirectory));
            }
        }
        if (fileList.length === 0) return 'rm: Missing parameter';

    }

    /**
     * Create help for this command.
     */
    getHelp() {
        return {
            type: 'command',
            category: 'Commands > Creator Commands > Filesystem',
            description: `
                <p>The <b>rm</b> command removes each specified file.  
                By default, it does not remove directories.</p>

                <p>If the <i class="u">-I</i> or <i class="u">
                --interactive=once</i> option is given, and  there are more 
                than three files or the <i>-r</i>, <i>-R</i>, or
                <i>--recursive</i> are given, then <b>rm</i> prompts the 
                user for whether to proceed with the entire operation.</p>

                <p>Otherwise, if a file is unwritable, standard input is an
                interactive client, and the <i>-f</i> or <i>--force</i>
                option is not specified, or the <b>-i</b> or the
                <i>--interactive=always</i> option(s) are given, <b>rm</b>
                prompts the user for whether to remove each file.  If the
                response is not affirmative, the file is skipped.</p>
            `,
            options: [
                {
                    switches: ['-f', '--force'],
                    description: 'Ignore non-existent files and arguments, never prompt'
                },
                {
                    switches: '-i',
                    description: 'Prompt before every removal'
                },
                {
                    switches: '-I',
                    description: `Prompt once before removing more than three 
                    files, or when removing recursively; less intrusive than 
                    <i>-i</i>, while still protecting against most mistakes.`
                },
                {
                    switches: ['-r', '-R', '--recursive'],
                    description: 'Removes directories and their contents recursively'
                },
                {
                    switches: ['-d', '--dir', '--dirs'],
                    description: 'Removes empty directories'
                },
                {
                    switches: ['-v', '--verbose'],
                    description: 'Explain what actions are being performed'
                }
            ],
            command: 'rm',
            name: 'rm - Remove files or directories',
            usage: 'rm [OPTIONS]... [FILE]...',
            seeAlso: 'rmdir, mkdir, cp, mv'
        };
    }
}

module.exports = RmCommand;
