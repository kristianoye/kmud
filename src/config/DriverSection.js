const
    { DriverNetworkingSection } = require('./DriverSectionNetworking'),
    MUDCompilerSection = require('./DriverSectionCompiler');

/**
 * The driver section controls the nuts and bolts of the game.
 */
class DriverSection {
    constructor(data) {
        /** @type {string} */
        this.core = data.core;

        /** @type {boolean} */
        this.useObjectProxies = typeof data.useObjectProxies === 'boolean' ? data.useObjectProxies : true;

        /** @type {boolean} */
        this.useRevocableProxies = typeof data.useRevocableProxies === 'boolean' ? data.useRevocableProxies : false;

        /** @type {string} */
        this.objectCreationMethod = typeof data.objectCreationMethod === 'string' ? data.objectCreationMethod : 'inline';

        /** @type {MUDCompilerSection} */
        this.compiler = new MUDCompilerSection(data.compiler);

        /** @type {MUDNetworkingSection} */
        this.networking = new DriverNetworkingSection(data.networking);
    }

    assertValid() {
        if (['inline', 'thinWrapper', 'fullWrapper'].indexOf(this.objectCreationMethod) === -1) {
            throw new Error(`Invalid setting for driver.objectCreationMethod: Got ${data.objectCreationMethod} [valid values: inline, thinWrapper, fullWrapper`);
        }
        this.networking.assertValid();
        return this;
    }
}

module.exports = DriverSection;
