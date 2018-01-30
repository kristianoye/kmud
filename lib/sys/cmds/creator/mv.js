const
    Command = require('../../../base/Command');

/**
 * Moves (renames) files.
 */
class MoveCommand extends Command {
    /**
     * @returns {MUDFS.MoveOptions}
     */
    init() {
        return {};
    }
    /**
     * 
     * @param {string[]} args
     * @param {MUDInputEvent} evt
     */
    cmd(args, evt) {
        let flags = 0,
            fileList = [],
            op = this.init();

        for (let i = 0; i < args.length; i++) {
            let opt = args[i];

            if (opt.startsWith('-')) {
                let opts = opt.charAt(1) === '-' ? [opt] : opt.slice(1).split('');
                for (let j = 0; j < opts.length; j++) {
                    switch (opts[j]) {
                        case 'f': case '--force':
                            op.prompt = false;
                            break;

                        case 'i': case '--prompt':
                            op.prompt = (/** @type {string} */ file) => {
                                efuns.addPrompt({ text: `mv: overwrite '${file}? '` }, resp => {
                                    return resp.charAt(0) === 'y' || resp.charAt(0) === 'Y';
                                });
                            };
                            break;

                        case 't':
                            if (++i === args.length)
                                return this.useError(`option '${args[i - 1]}' requires an argument`);
                            op.targetDirectory = efuns.resolvePath(args[i], thisPlayer.workingDirectory);
                            break;

                        case 'T':
                            break;

                        case 'v': case '--verbose':
                            op.
                            break;

                        case '--':
                            if (++i < args.length)
                                fileList.push(efuns.resolvePath(args[i], thisPlayer.workingDirectory));
                            else
                                return this.useError('Missing parameter');
                            break;

                        default:
                            if (opts[j].startsWith('--suffix')) {

                            }
                            return this.useError(`Unknown option: ${opts[j]}`);
                    }
                }
            }
            else {
                fileList.push(efuns.resolvePath(opt, thisPlayer.workingDirectory));
            }
        }
        if (fileList.length === 0) return this.useError('Missing parameter');
        return true;
    }

    /**
     * Create help for this command.
     */
    getHelp() {
        return {
            type: 'command',
            category: 'Commands > Creator Commands > Filesystem',
            description: `
                <p>The <b>mv</b> command renames SOURCE TO DEST, or moves
                SOURCE(s) to DIRECTORY.</p>
            `,
            options: [
                {
                    switches: ['-f', '--force'],
                    description: 'Ignore non-existent files and arguments, never prompt'
                },
                {
                    switches: '-i',
                    description: 'Prompt before overwriting any destination file'
                },
                {
                    switches: ['-v', '--verbose'],
                    description: 'Explain what actions are being performed'
                }
            ],
            command: 'mv',
            name: 'mv - Move files or directories',
            usage: 'mv [OPTIONS]... [FILE]...',
            seeAlso: 'rmdir, mkdir, cp, mv, RM'
        };
    }
}

module.exports = RmCommand;
