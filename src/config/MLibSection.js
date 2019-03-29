const
    ConfigUtil = require('../ConfigUtil'),
    MudlibMasterObject = require('./MudlibMasterObject'),
    MudlibFileSystem = require('./MudlibFileSystem').MudlibFileSystem,
    path = require('path');

class MudlibSection {
    /**
     * Construct a mudlib section object
     * @param {MudlibSection} data
     */
    constructor(data) {
        logger.log('MudlibSection constructor called.');

        /** @type {Object.<string,string>} */
        this.applyNames = { length: 0 };
        if (data.applyNames)
            Object.keys(data.applyNames).forEach(key => {
                this.applyNames[key] = data.applyNames[key];
                this.applyNames.length++;
            });

        /** @type {string} */
        this.backboneUid = data.backboneUid || 'BACKBONE';

        /** @type {string} */
        this.baseDirectory = data.baseDirectory || path.join(__dirname, '..', '..');

        /** @type {string} */
        this.defaultError = data.defaultError || 'What?';

        /** @type {string} */
        this.defaultSaveExtension = data.defaultSaveExtension || '.json';

        /** @type {MudlibFileSystem} */
        this.fileSystem = new MudlibFileSystem(data.fileSystem || {});

        /** @type {string} */
        this.heartbeatInterval = ConfigUtil.parseTime(data.heartbeatInterval) || 1000;

        /** @type {string[]} */
        this.includePath = Array.isArray(data.includePath) ? data.includePath : ['/base/include', '/sys/include'];

        /** @type {MudlibMasterObject} */
        this.master = new MudlibMasterObject(data.master || {
            "path": "/sys/daemon/GameMaster",
            "parameters": {}
        });

        /** @type {string} */
        this.logDirectory = data.logDirectory || '/log';

        /** @type {string} */
        this.loginObject = data.loginObject;

        /** @type {number} */
        this.objectResetInterval = ConfigUtil.parseTime(data.objectResetInterval || '30 minutes');

        /** @type {string} */
        this.simulEfuns = data.simulEfuns || false;

        /** @type {string} */
        this.mudlibName = 'KMUD';

        /** @type {number} */
        this.mudlibVersionMajor = 0;

        /** @type {number} */
        this.mudlibVersionMinor = 3;

        /** @type {number} */
        this.mudlibPatchVersion = 1;

        /** @type {string} */
        this.rootUid = data.rootUid || 'ROOT';
    }

    assertValid() {
        this.master.assertValid();
        this.fileSystem.assertValid();
    }

    getVersion() {
        return `${this.mudlibName} v${this.mudlibVersionMajor}.${this.mudlibVersionMinor}.${this.mudlibPatchVersion}`;
    }
}

MudlibSection.createDefault = function () {
    return new MudlibSection({
        master: '',
        simulEfuns: '/sys/lib/SimulEfuns'
    });
};

/**
 * Create UI to configure the mudlib section.
 * @param {MudlibSection} mudlib
 */
MudlibSection.createDialog = function (mudlib) {
    const Dialog = require('../Dialog');

    let dlg = new Dialog.MainMenu({
        text: 'This menu allows to set mudlib-specific settings.\r\nWARNING: Only change these settings if you know what you are doing!',
        prompt: 'MUDLib Settings'
    });

    dlg.add({
        text: () => `Set Mudlib Directory [${mudlib.baseDirectory}]`,
        char: 'd',
        control: new Dialog.SimplePrompt({
            question: () => `Mudlib Directory [${mudlib.baseDirectory}]: `,
            defaultValue: () => mudlib.baseDirectory,
            type: 'string'
        }),
        callback: (baseDirectory) => {
            mudlib.baseDirectory = baseDirectory;
        }
    });

    dlg.add({
        text: () => `Set Reset Interval [${mudlib.objectResetInterval} ms]`,
        char: 'r',
        control: new Dialog.SimplePrompt({
            question: () => `Reset Interval [${mudlib.objectResetInterval} ms]: `,
            defaultValue: () => mudlib.objectResetInterval,
            type: 'number',
            min: 5 * 6000
        }),
        callback: (objectResetInterval) => {
            mudlib.objectResetInterval = objectResetInterval;
        }
    });

    dlg.add({
        text: 'Return to MUD Menu',
        char: 'm',
        callback: () => {
            Dialog.writeLine('Returning to MUD Menu');
            return Dialog.DlgResult.OK;
        }
    });

    return dlg;
};

module.exports = MudlibSection;
