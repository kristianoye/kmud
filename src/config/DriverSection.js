const
    ConfigUtil = require('./ConfigShared').ConfigUtil,
    { DriverNetworking } = require('./DriverNetworking'),
    DriverCompiler = require('./DriverCompiler');

/**
 * The driver section controls the nuts and bolts of the game.
 */
class DriverSection {
    constructor(data) {
        /** @type {string} */
        this.core = data.core;

        /** @type {Object.<string,boolean>} */
        this.features = data.features || {};

        /** @type {number} */
        this.resetPollingInterval = ConfigUtil.parseTime(data.resetPollingInterval || 5000);

        /** @type {boolean} */
        this.useLazyResets = data.useLazyResets || false;

        /** @type {boolean} */
        this.useObjectProxies = typeof data.useObjectProxies === 'boolean' ? data.useObjectProxies : true;

        /** @type {boolean} */
        this.useRevocableProxies = typeof data.useRevocableProxies === 'boolean' ? data.useRevocableProxies : false;

        /** @type {string} */
        this.objectCreationMethod = typeof data.objectCreationMethod === 'string' ? data.objectCreationMethod : 'inline';

        /** @type {DriverCompiler} */
        this.compiler = new DriverCompiler(data.compiler);

        /** @type {DriverNetworking} */
        this.networking = new DriverNetworking(data.networking);
    }

    assertValid() {
        if (['inline', 'thinWrapper', 'fullWrapper'].indexOf(this.objectCreationMethod) === -1) {
            throw new Error(`Invalid setting for driver.objectCreationMethod: Got ${data.objectCreationMethod} [valid values: inline, thinWrapper, fullWrapper`);
        }
        if (typeof this.features !== 'object')
            throw new Error(`Invalid driver.features setting; Expected object, but got ${typeof this.features}`);
        Object.keys(this.features).forEach((key, index) => {
            if (typeof key !== 'string')
                throw new Error(`Invalid driver.features entry [index ${key}]; Key must be string and not ${typeof key}.`);
            if (typeof this.features[key] !== 'boolean')
                throw new Error(`Invalid driver.features entry for ${key}; Value must be boolean and not ${typeof this.features[key]}`);
        });
        this.compiler.assertValid();
        this.networking.assertValid();
        return this;
    }

    /**
     * Check to see if a particular driver feature is enabled.
     * @param {string} feature
     * @returns {boolean} True if the specified feature is defined and enabled.
     */
    hasFeature(feature) {
        if (!this.features) return false;
        return this.features[feature] || false;
    }
}

module.exports = DriverSection;
