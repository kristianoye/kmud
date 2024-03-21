/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_SHELLCMD } from 'Base';
import Command from LIB_SHELLCMD;


export default singleton class CompileCommand extends Command {
    /**
     * 
     * @param {string} args
     * @param {ClientCommand} evt
     */
    override async cmd(args, evt) {
        let player = thisPlayer,
            path = efuns.resolvePath(args[0], player.workingDirectory);
        /** @type {MUDCompilerOptions} */
        let options = { file: path, reload: true };

        try {
            for (let i = 0, max = evt.args.length; i < evt.args.length; i++) {
                let arg = evt.args[i];
                if (typeof arg === 'string') {
                    if (arg.startsWith('-')) {
                        switch (arg) {
                            case '-o':
                            case '--output':
                                if (++i === max)
                                    throw new Error(`Switch ${arg} requires parameter [output file]`);
                                options.compilerOutput = efuns.resolvePath(evt.args[i], player.workingDirectory);
                                break;
                        }
                    }
                    else
                        options.file = efuns.resolvePath(arg, player.workingDirectory);
                }
            }

            let result = efuns.objects.reloadObjectAsync(options);
            writeLine(JSON.stringify(result));
        }
        catch (x) {
            writeLine('No bueno: ' + x);
            writeLine(x.stack);
        }
    }
}
