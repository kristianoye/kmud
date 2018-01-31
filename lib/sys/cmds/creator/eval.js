
const
    Command = require('../../../base/Command');

class EvalCommand extends Command {
    /**
     * 
     * @param {string[]} args
     * @param {MUDInputEvent} evt
     */
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

module.exports = EvalCommand;

