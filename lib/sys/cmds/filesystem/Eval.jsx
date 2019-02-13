/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class EvalCommand extends Command {
    cmd(args, evt) {
        let tempFile = efuns.resolvePath(`/realms/${thisPlayer().name}/CMD_TMP_FILE.js`),
            source = `
            class EvalTemp extends MUDObject {
                evalCode() { ${evt.input} };
            }

            module.exports = new EvalTemp();
        `;

        if (efuns.writeFile(tempFile, source)) {
            try {
                let evalCode = efuns.reloadObjectSync(tempFile);
                let result = unwrap(evalCode, ob => ob.evalCode());
                write(efuns.identify(result));
            }
            catch (ex) {
                write(`Eval: Error: ${ex.message}`);
                write(ex.stack);
            }
        }
        return true;
    }

    getHelp() {
        return 'This contains helpful information.';
    }
}

module.exports = new EvalCommand();
