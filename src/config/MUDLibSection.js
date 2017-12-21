
class MUDLibSection {
    constructor(data) {

        /** @type {Object.<string,string>} */
        this.applyNames = data.applyNames;

        this.base = data.base;

        this.heartbeatInterval = parseInt(data.heartbeatInterval) || 1000;

        this.includePath = Array.isArray(data.includePath) ? data.includePath : [];

        /** @type {MUDMasterObjectConfig} */
        this.inGameMaster = new MUDMasterObjectConfig(data.inGameMaster);

        /** @type {string} */
        this.logDirectory = data.logDirectory || '/log';

        this.loginObject = data.loginObject;

        this.simulEfuns = data.simulEfuns || false;

        this.mudlibName = 'KMUD';
        this.mudlibVersionMajor = 0;
        this.mudlibVersionMinor = 3;
        this.mudlibPatchVersion = 1;
    }

    getVersion() {
        return `${this.mudlibName} v${this.mudlibVersionMajor}.${this.mudlibVersionMinor}.${this.mudlibPatchVersion}`;
    }
}

module.exports = MUDLibSection;
