/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

export default final singleton class EvalCommand extends Command {
    override async cmd(args, evt) {
        let tempFile = await efuns.fs.getFileAsync(efuns.resolvePath(`/realms/${thisPlayer().name}/CMD_TMP_FILE.js`)),
            source = `
            export default singleton class EvalTemp {
                async create() { }
                async evalCode() { ${args} };
            }
        `;

        if (!await tempFile.writeFileAsync(source))
            return 'Eval: Unable to create file';
        try {
            let tmpObject = await tempFile.compileAsync(),
                result = tmpObject && await tmpObject.evalCode();
            writeLine(`Result = ${efuns.identify(result)}`);
        }
        catch (ex) {
            writeLine(`Eval: Error: ${ex.message}`);
            writeLine(ex.stack);
        }
    }

    override getHelp() {
        return 'This contains helpful information.';
    }

    /**
     * Eval disables most options to preserve the literal text
     * @param {string} verb
     * @param {any} options
     * @returns
     */
    override getShellSettings(verb, options) {
        return Object.assign(options, {
            allowFileIO: false,
            allowPipelining: false,
            expandBackticks: false,
            expandFileExpressions: false,
            expandVariables: false,
            preserveQuotes: true,
            command: this
        });
    }

}
