const
    DriverFeature = require('../config/DriverFeature');


class FeatureBase {
    /**
     * @param {DriverFeature} config Config data
     */
    constructor(config, flags) {
        this.flags = flags;
        this.id = config.id;
        this.name = config.name;
        this.parameters = config.parameters;
    }

    createDriverApplies(gameServer, gameServerPrototype) {
    }

    createExternalFunctions(efunPrototype) {
    }

    createGlobalData(data) {
    }

    createMasterApplies(masterObject, masterObjectPrototype) {
    }
}

module.exports = FeatureBase;