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
        let tempFile = efuns.resolvePath(`/realms/${thisPlayer.name}/CMD_TMP_FILE.js`),
            source = `
            class EvalTemp extends MUDObject {
                evalCode() { ${evt.input} };
            }

            module.exports = EvalTemp;
        `;

        efuns.writeFile(tempFile, source, (success, error) => {
            if (success) {
                try {
                    let evalCode = efuns.reloadObject(tempFile);
                    let result = unwrap(evalCode, ob => ob.evalCode());
                    write(efuns.identify(result));
                }
                catch (ex) {
                    write(`Error: ${ex.message}`);
                    write(ex.stack);
                }
                finally {
                    evt.complete();
                }
            }
            else throw error;
        });

        return evt.complete;
    }

    getHelp() {
        return 'This contains helpful information.';
    }
}

module.exports = new EvalCommand();
