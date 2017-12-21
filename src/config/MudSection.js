const
    MUDPasswordPolicy = require('./MUDPasswordPolicy'),
    { assertType } = require('./ConfigShared'),
    MudPort = require('./MudPort');

class MudSection {
    constructor(data) {
        /** @type {string} */
        this.name = data.name || 'Another KMUD';

        /** @type {string} */
        this.adminName = data.adminName || '[Unspecified]';

        /** @type {string} */
        this.adminEmail = data.adminEmail || '[Unspecified]';

        /** @type {Object.<string,boolean>} */
        this.features = data.features || {};

        /** @type {MUDPasswordPolicy} */
        this.passwordPolicy = new MUDPasswordPolicy(data.passwordPolicy || { minLength: 5 });

        /** @type {MUDConfigPort[]} */
        this.portBindings = data.portBindings.map(p => new MudPort(p));
    }

    assertValid() {
        assertType(this.name, 'mud.name', 'string');
        assertType(this.adminName, 'mud.adminName', 'string');
        assertType(this.adminEmail, 'mud.adminEmail', 'string');
        assertType(this.features, 'mud.features', 'object');
    }
}

module.exports = MudSection;
