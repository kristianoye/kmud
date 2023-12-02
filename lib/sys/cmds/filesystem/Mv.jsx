/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

/**
 * Moves/rename files.
 */
export default singleton class MoveCommand extends Command {
    /**
     * @returns {MUDFS.MoveOptions}
     */
    createMoveRequest() {
        return {
            flags: 0,
            source: [],
            targetDirectory: false
        };
    }
    /**
     * Move/rename files
     * @param {string[]} args
     * @param {MUDInputEvent} evt
     */
    override async cmd(args, evt) {
        let flags = 0,
            fileList = [],
            op = this.createMoveRequest();

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
                            op.flags |= MUDFS.MoveFlags.Interactive;
                            op.prompt = (/** @type {string} */ file) => {
                                prompt('text', `mv: overwrite '${file}? '`, resp => {
                                    return resp.charAt(0) === 'y' || resp.charAt(0) === 'Y';
                                });
                            };
                            break;

                        case 't':
                            if (++i === args.length)
                                return this.useError(`option '${args[i - 1]}' requires parameter [directory]`);
                            if ((op.flags & MUDFS.MoveFlags.SingleFile) > 0)
                                return this.useError('cannot combine --target-directory (-t) and --no-target-directory (-T)');
                            op.targetDirectory = efuns.resolvePath(args[i], thisPlayer().workingDirectory);
                            break;

                        case 'T':
                            if (+i++ === args.length)
                                return this.useError(`option '${args[i - 1]}' requires parameter [file]`);
                            if ((op.flags & MUDFS.MoveFlags.SingleFile) === 0 && op.targetDirectory)
                                return this.useError('cannot combine --target-directory (-t) and --no-target-directory (-T)');
                            else if (op.targetDirectory)
                                return this.useError(`extra operand: ${args[i]}`);
                            op.targetDirectory = efuns.resolvePath(args[i], thisPlayer().workingDirectory);
                            op.flags |= MUDFS.MoveFlags.SingleFile;
                            break;

                        case 'v': case '--verbose':
                            op.flags |= MUDFS.MoveFlags.Verbose;
                            break;

                        case '--':
                            if (++i < args.length)
                                fileList.push(efuns.resolvePath(args[i], thisPlayer().workingDirectory));
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
                fileList.push(efuns.resolvePath(opt, thisPlayer().workingDirectory));
            }
        }
        if (!op.targetDirectory)
            op.targetDirectory = fileList.length && fileList.pop();

        if (fileList.length === 0)
            return this.useError('Missing parameter');

        let count = 0;
        op.source = Array(fileList.length);
        fileList.forEach((expr, index) => {
            efuns.fs.readDirectory(expr, MUDFS.GetDirFlags.Defaults | MUDFS.GetDirFlags.ResolveParent, (files, err) => {
                op.source[index] = err || files;
                if (++count === fileList.length)
                    return this.executeMove(evt, op);
            });
        });
        return evt.complete;
    }

    /**
     * 
     * @param {MUDInputEvent} evt The command event
     * @param {MUDFS.MoveOptions} op The move operation details
     */
    executeMove(evt, op) {
        op.source.forEach(files => {
            files.forEach(fi => {
                // TODO: Fix this non-existant efun
                efuns.movePath(fi.path, op.targetDirectory, op);
                if (op.flags & MUDFS.MoveFlags.Verbose) {
                    writeLine(`mv: ${fi.path} -> ${fi.targetDirectory}`);
                }
            });
        });
        return evt.complete();
    }

    /**
     * Create help for this command.
     */
    override getHelp() {
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
