/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command),
    RM_OPT_INTERACTIVE = 1 << 0,
    RM_OPT_RMEMPTYDIRS = 1 << 1,
    RM_OPT_SMARTPROMPT = 1 << 2,
    RM_OPT_RECURSIVE = 1 << 3,
    RM_OPT_VERBOSE = 1 << 4,
    VERSION = '1.01';

class RmOperation {
    /**
     * Constuct a new removal operation object
     * @param {number} flags The flags controlling the remove operation.
     * @param {string[]} files The files to be removed.
     */
    constructor(flags, files) {
        this.flags = flags;
        this.files = files;
    }

    addFiles(spec) {
        if (Array.isArray(spec))
            this.files.push(...spec);
        else if (typeof spec === 'string')
            this.files.push(spec);
    }

    /**
     * Add a flag to the operation
     * @param {number} flags One or more flags to add
     */
    addFlag(flags) {
        this.flags |= flags;
        return this;
    }

    /**
     * Determine if a particular flag is set.
     * @param {number} flags The flags to check
     * @returns {boolean} Returns true if the flag(s) are set.
     */
    hasFlag(flags) {
        return (this.flags & flags) === flags;
    }

    /**
     * Remove a flag from the operation
     * @param {number} flags One or more flags to remove.
     */
    removeFlag(flags) {
        this.flags &= ~flags;
        return this;
    }

    get length() {
        return this.files.length;
    }
}

/**
 * Removes files from the filesystem.
 */
class RmCommand extends Command {
    /**
     * 
     * @param {string} str The raw input from the user
     * @param {MUDInputEvent} evt
     */
    cmd(str, evt) {
        let args = evt.args,
            cwd = thisPlayer().workingDirectory,
            op = new RmOperation(0, []);
            
        for (let i = 0; i < args.length; i++) {
            let opt = args[i];

            if (opt.startsWith('-')) {
                let opts = opt.charAt(1) === '-' ? [opt] : opt.slice(1).split('');
                for (let j = 0; j < opts.length; j++) {
                    switch (opts[j]) {
                        case 'd':
                        case '--dirs':
                        case '--dir':
                            op.addFlag(RM_OPT_RMEMPTYDIRS);
                            break;

                        case 'f':
                        case '--force':
                            op.removeFlag(RM_OPT_INTERACTIVE | RM_OPT_SMARTPROMPT);
                            break;

                        case '--help':
                            return this.getUsage();

                        case 'i':
                        case '--prompt':
                            op.addFlag(RM_OPT_INTERACTIVE);
                            break;

                        case '--interactive':
                            {
                                let { cmdopt, when } = opts[j].split('=', 2);
                                switch ((when || 'always').toLower()) {
                                    case 'once':
                                    case 'smart':
                                        op.addFlag(RM_OPT_SMARTPROMPT).removeFlag(RM_OPT_INTERACTIVE);
                                        break;

                                    case 'always':
                                        op.addFlag(RM_OPT_INTERACTIVE).removeFlag(RM_OPT_SMARTPROMPT);
                                        break;

                                    case 'never':
                                        op.removeFlag(RM_OPT_INTERACTIVE | RM_OPT_SMARTPROMPT);
                                        break;

                                    default:
                                        throw `Unrecognized condition for --interactive: ${when}`;
                                }
                            }
                            break;

                        case 'I':
                            op.addFlag(RM_OPT_SMARTPROMPT).removeFlag(RM_OPT_INTERACTIVE);
                            break;

                        case 'r':
                        case 'R':
                        case '--recursive':
                            op.addFlag(RM_OPT_RECURSIVE);
                            break;

                        case 'v':
                        case '--verbose':
                            op.addFlag(RM_OPT_VERBOSE);
                            break;

                        case '--':
                            if (++i < args.length)
                                op.addFiles(args.map(f => efuns.resolvePath(f, cwd)));
                            else
                                return this.useError('Missing parameter');
                            break;

                        case '--version':
                            return `rm (KMUD coreutils) ${VERSION}`;

                        default:
                            return this.useError(`Unknown option: ${opts[j]}`);
                    }
                }
            }
            else {
                op.addFiles(efuns.resolvePath(opt, cwd));
            }
        }
        if (op.length === 0)
            return this.useError('Missing operand');

        return true;
    }

    getUsage() {
        return `
Usage: rm [OPTION]... FILE...
Remove (unlink) the FILE(s).

  -f, --force           ignore nonexistent files and arguments, never prompt
  -i                    prompt before every removal
  -I                    prompt once before removing more than three files, or
                          when removing recursively; less intrusive than -i,
                          while still giving protection against most mistakes
      --interactive[=WHEN]  prompt according to WHEN: never, once (-I), or
                          always (-i); without WHEN, prompt always
      --one-file-system  when removing a hierarchy recursively, skip any
                          directory that is on a file system different from
                          that of the corresponding command line argument
      --no-preserve-root  do not treat '/' specially
      --preserve-root   do not remove '/' (default)
  -r, -R, --recursive   remove directories and their contents recursively
  -d, --dir             remove empty directories
  -v, --verbose         explain what is being done
      --help     display this help and exit
      --version  output version information and exit

By default, rm does not remove directories.  Use the --recursive (-r or -R)
option to remove each listed directory, too, along with all of its contents.

To remove a file whose name starts with a '-', for example '-foo',
use one of these commands:
  rm -- -foo

  rm ./-foo

Note that if you use rm to remove a file, it might be possible to recover
some of its contents, given sufficient expertise and/or time.`;
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

module.exports = new RmCommand();
