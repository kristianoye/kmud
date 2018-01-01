const
    ConfigUtil = require('../ConfigUtil'),
    MudlibMasterObject = require('./MudlibMasterObject');

class MudlibSection {
    constructor(data) {

        /** @type {Object.<string,string>} */
        this.applyNames = data.applyNames;

        /** @type {string} */
        this.baseDirectory = data.baseDirectory;

        /** @type {string} */
        this.defaultError = data.defaultError || 'What?';

        /** @type {string} */
        this.defaultSaveExtension = data.defaultSaveExtension || '.json';

        /** @type {string} */
        this.heartbeatInterval = ConfigUtil.parseTime(data.heartbeatInterval) || 1000;

        /** @type {string[]} */
        this.includePath = Array.isArray(data.includePath) ? data.includePath : [];

        /** @type {MudlibMasterObject} */
        this.inGameMaster = new MudlibMasterObject(data.inGameMaster);

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
    }

    assertValid() {
        this.inGameMaster.assertValid();
    }

    getVersion() {
        return `${this.mudlibName} v${this.mudlibVersionMajor}.${this.mudlibVersionMinor}.${this.mudlibPatchVersion}`;
    }
}

module.exports = MudlibSection;
