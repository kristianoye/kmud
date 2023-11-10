/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class UpdateCommand extends Command {
    async cmd(text, input) {
        if (input.args.length === 0) {
            let env = unwrap(thisPlayer().environment);

            if (!env)
                return error('You do not have an environment!');

            input.args.unshift(env.filename);
        }

        let options = {
            /**
             * The files to update
             * @type {string[]}
             */
            files: [],

            /**
             * Options to pass to the compiler
             * @type {number}
             */
            flags: 0,

            /**
             * Optional path to save intermediate output to
             * @type {string}
             */
            intermediate: false,

            /**
             * Options to pass to the compiler
             * @type {number}
             */
            verbose: 0,

            createCompilerOptions: function (file) {
                return {
                    file,
                    onDebugOutput: (msg, level) => {
                        if (level >= this.verbose)
                            writeLine(msg);
                    }
                }
            }
        };

        for (let i = 0, max = input.args.length; i < max; i++) {
            /** @type {string} */
            let arg = input.args[i];

            if (arg.startsWith('-')) {
                if (!arg.startsWith('--')) {
                    let switches = arg.split('')
                        .filter(s => s.length === 1);

                    for (let j = 0; j < switches.length; j++) {
                        switch (switches[j]) {
                            case 'h':
                                return this.showHelp();
                            case 'i':
                                if (++i === max)
                                    return `Update: Option ${arg} requires parameter [path]`;
                                else {
                                    let
                                        savePath = efuns.resolvePath(fn, thisPlayer().workingDirectory),
                                        saveDir = await efuns.fs.getDirectoryAsync(savePath);

                                    options.intermediate = saveDir;
                                }
                                break;
                            case 'v':
                                options.verbose++;
                                break;

                            default:
                                return `Update: Unrecognized switch: ${switches[j]}`;
                        }
                    }
                }
                else {
                    switch (arg) {
                        case '--help':
                            return showHelp();

                        case '--intermediate':
                            if (++i === max)
                                return `Update: Option ${arg} requires parameter [path]`;
                            else {
                                let
                                    savePath = efuns.resolvePath(fn, thisPlayer().workingDirectory),
                                    saveDir = await efuns.fs.getDirectoryAsync(savePath);

                                options.intermediate = saveDir;
                            }
                            break;

                        case '--verbose':
                            options.verbose++;
                            break;

                        default:
                            return `Update: Unrecognized option: ${arg}`;
                    }
                }
            }
            else {
                let fn = input.args[i],
                    path = efuns.resolvePath(fn, thisPlayer().workingDirectory);

                options.files.push(path);
            }

        }
        if (options.files.length === 0) {
            return 'Update: You must specify at least one file';
        }
        for (let i = 0; i < options.files.length; i++) {
            let path = options.files[i],
                fso = await efuns.fs.getFileAsync(path);

            try {
                let result = await fso.compileAsync(options.createCompilerOptions(path));
                if (result === true)
                    writeLine(`Update ${path}: [Ok]`);
                else
                    writeLine(`Update ${path}: [${result}]`);
            }
            catch (err) {
                writeLine(`Update ${path}: Failure: ${err.message}`);
            }
        }
        return true;
    }

    showHelp() {
        writeLine(`
Command:     update

Description: Allows the game creators to make real-time updates to the 
             mudlib code.

Usage:       update [options] file1 [...fileN]
------------------------------------------------------------------------------
Options:
    -h, --help
        Shows this text.

    -i, --intermediate <directory>
        Saves intermediate and final compiler output to the specified path.

    -v, --verbose
        Displays verbose output from the compiler
`);
    }
}

module.exports = await createAsync(UpdateCommand);
