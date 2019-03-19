
const
    Dialog = require('../Dialog'),
    DlgResult = Dialog.DlgResult,
    MUDConfig = require('../MUDConfig');

class ConfigApp extends Dialog.ConsoleApp {
    /**
     * Create a config application instance
     * @param {MUDConfig} config The configuration object to be altered.
     */
    constructor(config) {
        super({
            text: 'This utility allows you to alter the MUD configuration file.',
            prompt: 'Main Menu'
        });
        this.config = config;

        this.add({
            text: 'Change Basic Settings',
            char: 'b',
            control: require('./MudSection').createDialog(config.mud)
        });

        this.add({
            text: 'Quit Without Saving Changes',
            char: 'w',
            callback: () => {
                Dialog.writeLine('Aborting.');
                return DlgResult.Abort;
            }
        });

        this.add({
            text: 'Save Config and Exit',
            char: 's',
            callback: () => {
                Dialog.writeLine('Saving.');
                return DlgResult.OK;
            }
        })
    }
}

module.exports = ConfigApp;
