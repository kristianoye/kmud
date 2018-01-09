const
    ConfigUtil = require('../ConfigUtil'),
    FeatureBase = require('../features/FeatureBase'),
    path = require('path');

class DriverFeature {
    constructor(id, data, pos, driverFlags) {
        /** @type {Object.<string,boolean>} */
        this.driverFlags = driverFlags;

        /** @type {boolean} */
        this.enabled = data.enabled;

        /** @type {FeatureBase} */
        this.instance = null;

        /** @type {string} */
        this.id = id;

        /** @type {string} */
        this.name = data.name;

        /** @type {string} */
        this.description = data.description || '[No Description Available]';

        /** @type {string} */
        this.module = data.module;

        /** @type {object} */
        this.parameters = data.parameters || {};

        /** @type {number} */
        this.position = pos;
    }

    assertValid() {
        ConfigUtil.assertType(this.id, `drivers.features[${this.position}].id`, 'string');
        ConfigUtil.assertType(this.name, `drivers.features[${this.position}].name`, 'string');
        ConfigUtil.assertType(this.name, `drivers.features[${this.position}].name`, 'string');
        ConfigUtil.assertType(this.module, `drivers.features[${this.position}].module`, 'string');
        ConfigUtil.assertType(this.enabled, `drivers.features[${this.position}].enabled`, 'boolean');
    }

    initialize() {
        if (this.enabled) {
            let featurePath = path.resolve(__dirname, '..', this.module),
                feature = require(featurePath);

            if (feature.prototype instanceof FeatureBase) {
                this.instance = new feature(this, this.driverFlags);
                return this.instance;
            }
            throw new Error(`Invalid feature module: ${this.module}; Export must inherit FeatureBase.`);
        }
    }
}

module.exports = DriverFeature;
