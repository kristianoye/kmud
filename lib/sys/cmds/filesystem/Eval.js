/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class EvalCommand extends Command {
    cmd(args, evt) {
        let tempFile = efuns.resolvePath(`/realms/${thisPlayer().name}/CMD_TMP_FILE.js`),
            source = `
            class EvalTemp extends MUDObject {
                evalCode() { ${args} };
            }

            module.exports = new EvalTemp();
        `;

        if (efuns.writeFile(tempFile, source)) {
            try {
                let evalCode = efuns.reloadObjectSync(tempFile);
                let result = unwrap(evalCode, ob => ob.evalCode());
                writeLine(efuns.identify(result));
            }
            catch (ex) {
                writeLine(`Eval: Error: ${ex.message}`);
                writeLine(ex.stack);
            }
        }
        return true;
    }

    getHelp() {
        return 'This contains helpful information.';
    }
}

module.exports = await createAsync(EvalCommand);
