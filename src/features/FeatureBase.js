/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
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

    assertValid() { }

    createDriverApplies(gameServer, gameServerPrototype) { }

    createExternalFunctions(efunPrototype) { }

    createGlobalData(data) { }

    createMasterApplies(masterObject, masterObjectPrototype) { }

    createObjectApplies(objectPrototype) { }
}

module.exports = FeatureBase;