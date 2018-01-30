const
    ConfigUtil = require('../ConfigUtil'),
    { DriverNetworking } = require('./DriverNetworking'),
    DriverCompiler = require('./DriverCompiler'),
    DriverFeature = require('./DriverFeature'),
    merge = require('merge'),
    path = require('path');

/** 
 * @module DriverSection
 * @local forEachFeatureCallback
 */

class DriverSection {
    constructor(data) {
        /** @type {string} */
        this.core = data.core;

        /** @type {string} */
        this.driverPath = path.resolve(__dirname, '..');

        /**@type {Object.<string,boolean>} */
        this.featureFlags = {};

        /** @type {Object.<string,DriverFeature>} */
        this.features = {};

        if (typeof data.features === 'object') {
            Object.keys(data.features).forEach((id, pos) => {
                this.features[id] = new DriverFeature(id, data.features[id], pos, this.featureFlags);
            });
        }

        /** @type {number} */
        this.maxCommandExecutionTime = data.maxCommandExecutionTime || 0;

        /** @type {number} */
        this.maxCommandLength = data.maxCommandLength || 1024;

        /** Maximum number of commands per player per second. 
         * @type {number} */
        this.maxCommandsPerSecond = data.maxCommandsPerSecond || 10;

        /** @type {number} */
        this.maxCommandStackSize = data.maxCommandStackSize || 100;

        /** @type {number} */
        this.maxEvalTime = data.maxEvalTime > 0 ? data.maxEvalTime : 0; // unlimited

        /** @type {number} */
        this.resetPollingInterval = ConfigUtil.parseTime(data.resetPollingInterval || 5000);

        /** @type {boolean} */
        this.showDriverFrames = typeof data.showDriverFrames === 'boolean' ? data.showDriverFrames : false;

        /** @type {boolean} */
        this.useLazyResets = data.useLazyResets || false;

        /** @type {boolean} */
        this.useObjectProxies = typeof data.useObjectProxies === 'boolean' ? data.useObjectProxies : false;

        /** @type {boolean} */
        this.useRevocableProxies = typeof data.useRevocableProxies === 'boolean' ? data.useRevocableProxies : false;

        /** @type {string} */
        this.objectCreationMethod = typeof data.objectCreationMethod === 'string' ? data.objectCreationMethod : 'inline';

        /** @type {DriverCompiler} */
        this.compiler = new DriverCompiler(merge(DriverCompiler.defaults, data.compiler || {}));

        /** @type {DriverNetworking} */
        this.networking = new DriverNetworking(merge(DriverNetworking.defaults, data.networking || {}));
    }

    assertValid() {
        if (['inline', 'thinWrapper', 'fullWrapper'].indexOf(this.objectCreationMethod) === -1) {
            throw new Error(`Invalid setting for driver.objectCreationMethod: Got ${data.objectCreationMethod} [valid values: inline, thinWrapper, fullWrapper`);
        }
        this.forEachFeature((feature, index) => feature.assertValid());
        this.compiler.assertValid();
        this.networking.assertValid();
        ConfigUtil.assertRange(this.maxCommandLength, 'driver.maxCommandLength', 100, 1024 * 4);
        return this;
    }

    /**
     * Iterate through all of the features and do some action.
     * @param {function(string, number, DriverFeature):DriverFeature} callback
     * @returns {DriverFeature[]}
     */
    forEachFeature(callback) {
        return Object.keys(this.features).map((id, index) => callback(this.features[id], index, id));
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
