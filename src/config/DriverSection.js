const
    ConfigUtil = require('../ConfigUtil'),
    { DriverNetworking } = require('./DriverNetworking'),
    DriverCompiler = require('./DriverCompiler'),
    DriverFeature = require('./DriverFeature');

/**
 * The driver section controls the nuts and bolts of the game.
 */
class DriverSection {
    constructor(data) {
        /** @type {string} */
        this.core = data.core;

        /**@type {Object.<string,boolean>} */
        this.featureFlags = {};

        /** @type {DriverFeature[]} */
        this.features = (Array.isArray(data.features) ? data.features : [])
            .map((spec, pos) => new DriverFeature(spec, pos, this.featureFlags));

        /** @type {number} */
        this.maxCommandLength = data.maxCommandLength || 1024;

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
        this.features.forEach((feature) => feature.assertValid());
        this.compiler.assertValid();
        this.networking.assertValid();
        ConfigUtil.assertRange(this.maxCommandLength, 'driver.maxCommandLength', 100, 1024 * 4);
        return this;
    }

    /**
     * Check to see if a particular driver feature is enabled.
     * @param {string} feature
     * @returns {boolean} True if the specified feature is defined and enabled.
     */
    hasFeature(feature) {
        if (!this.featureFlags) return false;
        return this.featureFlags[feature] || false;
    }
}

module.exports = DriverSection;
