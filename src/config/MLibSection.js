const
    ConfigUtil = require('../ConfigUtil'),
    MudlibMasterObject = require('./MudlibMasterObject'),
    MudlibFileSystem = require('./MudlibFileSystem').MudlibFileSystem,
    path = require('path');

class MudlibSection {
    constructor(data) {
        logger.log('MudlibSection constructor called.');

        /** @type {Object.<string,string>} */
        this.applyNames = data.applyNames;

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
        this.includePath = Array.isArray(data.includePath) ? data.includePath : [];

        /** @type {MudlibMasterObject} */
        this.master = new MudlibMasterObject(data.master || {});

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
    return new MudlibSection({});
};

module.exports = MudlibSection;
