/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_SHELLCMD } from '@Base';
import Command from LIB_SHELLCMD;

const CompilerFlags = efuns.objects.compilerFlags;

export default singleton class UpdateCommand extends Command {
    override async cmd(text, input) {
        if (input.args.length === 0) {
            let env = thisPlayer().environment.instance;

            if (!env)
                return error('You appear to be in the void!');

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
            flags: CompilerFlags.None,

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

            createCompilerOptions: function (file, opts) {
                return Object.assign({
                    file,
                    onCompilerStageExecuted: function () { },
                    onDebugOutput: (msg, level) => {
                        if (level <= this.verbose)
                            writeLine(msg);
                    }
                }, opts);
            }
        };

        for (let i = 0, max = input.args.length; i < max; i++) {
            /** @type {string} */
            let arg = input.args[i];

            if (arg.startsWith('-')) {
                if (!arg.startsWith('--')) {
                    let switches = arg.slice(1)
                        .split('')
                        .filter(s => s.length === 1);

                    for (let j = 0, max = switches.length; j < max; j++) {
                        switch (switches[j]) {
                            case 'h':
                                return this.showHelp();

                            case 'i':
                                if (++i === max)
                                    return `Update: Option ${arg} requires parameter [path]`;
                                else {
                                    let savePath = efuns.resolvePath(input.args[i], thisPlayer().workingDirectory);

                                    /**
                                     * 
                                     * @param {string} fullPath
                                     * @param {number} stage
                                     * @param {number} maxStages
                                     * @param {string} source
                                     * @param {Error} err
                                     */
                                    options.onCompilerStageExecuted = async (fullPath, stage, maxStages, source, err) => {
                                        if (err === false) {
                                            let filename = fullPath.split('/').pop(),
                                                outputFilename = `${savePath}/${filename}.${stage}`,
                                                outputFile = await efuns.fs.getFileAsync(outputFilename);

                                            await outputFile.writeFileAsync(source);
                                        }
                                    };
                                }
                                break;

                            case 'c':
                                options.flags |= CompilerFlags.CompileOnly;
                                break;

                            case 'r':
                                options.flags |= CompilerFlags.Recursive;
                                break;

                            case 'v':
                                if (j + 1 < max) {
                                    let tmp = parseInt(switches[j + 1]);
                                    if (!isNaN(tmp)) {
                                        options.verbose = tmp;
                                        j++;
                                        break;
                                    }
                                }
                                options.verbose++;
                                break;

                            case 'x':
                                options.flags |= CompilerFlags.OnlyCompileDependents;
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
                                let savePath = efuns.resolvePath(input.args[i], thisPlayer().workingDirectory);

                                /**
                                 * 
                                 * @param {string} fullPath
                                 * @param {number} stage
                                 * @param {number} maxStages
                                 * @param {string} source
                                 * @param {Error} err
                                 */
                                options.onCompilerStageExecuted = async (fullPath, stage, maxStages, source, err) => {
                                    if (err === false) {
                                        let filename = fullPath.split('/').pop(),
                                            outputFilename = `${savePath}/${filename}.${stage}`,
                                            outputFile = await efuns.fs.getFileAsync(outputFilename);

                                        await outputFile.writeFileAsync(source);
                                    }
                                };
                            }
                            break;

                        case '--no-create':
                            options.flags |= CompilerFlags.CompileOnly;
                            break;

                        case '--no-create-deps':
                            options.flags |= CompilerFlags.OnlyCompileDependents;
                            break;

                        case '--update-deps':
                            options.flags |= CompilerFlags.Recursive;
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
                let result = await fso.compileAsync(options.createCompilerOptions(path, options));
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
        Shows this helpful text.

    -i, --intermediate <directory>
        Saves intermediate and final compiler output to the specified path.

    -c, --no-create
        Do not (re-)create instances after recompile.

    -x, --no-create-deps
        Do not (re-)create dependent instances after recompile.

    -r, --update-deps
        Automatically update dependencies as well (recursively).

    -v[0-5], --verbose
        Displays verbose output from the compiler.  Specify multiple times
        to increase verbosity.  e.g. update -vvv (debug level 3)
`);
    }
}
