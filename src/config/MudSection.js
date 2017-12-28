const
    MUDPasswordPolicy = require('./MUDPasswordPolicy'),
    ConfigUtil = require('..//ConfigUtil'),
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

        /** @type {MudPort[]} */
        this.portBindings = data.portBindings.map(p => new MudPort(p));
    }

    assertValid() {
        ConfigUtil.assertType(this.name, 'mud.name', 'string');
        ConfigUtil.assertType(this.adminName, 'mud.adminName', 'string');
        ConfigUtil.assertType(this.adminEmail, 'mud.adminEmail', 'string');
        ConfigUtil.assertType(this.features, 'mud.features', 'object');
    }
}

module.exports = MudSection;
