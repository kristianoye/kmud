
class MudlibMasterObject {
    constructor(data) {
        /** @type {string} */
        this.path = data.path;

        /** @type {Object.<string,any>} */
        this.parameters = data.parameters || {};
    }

    assertValid() {
        if (typeof this.path !== 'string')
            throw new Error(`Invalid value for mudlib.inGameMaster.path; Expected string but got ${typeof this.path}`);
        if (typeof this.parameters !== 'object')
            throw new Error(`Invalid value for mudlib.inGameMaster.parameters; Expected object but got ${typeof this.parameters}`);
    }
}

module.exports = MudlibMasterObject;
