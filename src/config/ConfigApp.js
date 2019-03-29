
const
    Dialog = require('../Dialog'),
    DlgResult = Dialog.DlgResult,
    MUDConfig = require('../MUDConfig'),
    path = require('path'),
    fs = require('fs');

class ConfigApp extends Dialog.ConsoleApp {
    /**
     * Create a config application instance
     * @param {MUDConfig} config The configuration object to be altered.
     * @param {{ configFile: string }} options The options from the command line.
     */
    constructor(config, options) {
        super({
            text: 'This utility allows you to alter the MUD configuration file.',
            prompt: 'Main Menu'
        });
        this.config = config;
        this.options = options;

        this.addHelp({
            b: 'Change basic settings like details about the MUD administrator, MUD name, TCP ports, etc.'
        });

        this.add({
            text: 'Change Basic Settings',
            char: 'b',
            control: require('./MudSection').createDialog(config.mud)
        });

        this.add({
            text: 'Change Mudlib Settings [Advanced]',
            char: 'u',
            control: require('./MLibSection').createDialog(config.mudlib)
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
                let savePath = path.resolve(__dirname, '..', options.configFile);
                Dialog.writeLine(`Saving config to ${savePath}`);
                fs.writeFileSync(savePath, JSON.stringify(config.createExport(), undefined, 3), { encoding: 'utf8', flag: 'w' });
                return DlgResult.OK;
            }
        })
    }
}

module.exports = ConfigApp;
