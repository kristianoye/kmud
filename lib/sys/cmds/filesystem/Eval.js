/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

export default final singleton class EvalCommand extends Command {
    override async cmd(args, evt) {
        let tempFile = efuns.resolvePath(`/realms/${thisPlayer().name}/CMD_TMP_FILE.js`),
            source = `
            class EvalTemp extends MUDObject {
                async create() { }
                async evalCode() { ${args} };
            }

            module.defaultExport = await createAsync(EvalTemp);
        `;

        if (await efuns.fs.writeFileAsync(tempFile, source)) {
            try {
                let evalCode = await efuns.objects.reloadObjectAsync(tempFile);
                if (evalCode) {
                    let ob = unwrap(evalCode);
                    let result = await ob.evalCode();

                    if (efuns.isAsync(result)) {
                        return await result;
                    }
                    writeLine(efuns.identify(result));
                }
                else
                    return `Failed to load code expression`;
            }
            catch (ex) {
                writeLine(`Eval: Error: ${ex.message}`);
                writeLine(ex.stack);
            }
        }
        return true;
    }

    override getHelp() {
        return 'This contains helpful information.';
    }
}
