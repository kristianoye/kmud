/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides single interface for interacting with databases.
 */
const
    ConfigUtil = require('../ConfigUtil');

/**
 * Abstract class for database implementations.
 */
class IDatabase {
    /**
     * Construct a db config
     * @param {any} config
     */
    constructor(config) {
        this.#driver = config.driver;
        this.#options = config.options;
    }

    connect() {
        throw new Error('Not implemented');
    }

    #driver;

    #options;

    /** Contains the name of the driver required to interact with this database. 
     * @returns {string} */
    get driver() { return this.#driver; }

    /** Contains settings required to connect to the database. 
     * @returns {Object.<string,any>} */
    get options() { return this.#options; }
}

/**
 * Create a database-specific configuration object based on the driver type.
 * @param {string} dbId The database name/key
 * @param {DBImp} config The database configuration data.
 * @returns {DBImp}
 */
IDatabase.create = function (dbId, config) {
    let configType = false;

    if (!config.driver || typeof config.driver !== 'string')
        throw new Error(`Database '${dbId}' did not specify a driver type!`);

    switch (config.driver.toLowerCase()) {
        case 'mysql':
        case 'mariadb':
            configType = config.driverPath || './MySqlDb';
            break;

        default:
            configType = config.driverPath || `./${config.driver}Db`;
            break;
    }

    if (!configType)
        throw new Error(`Could not locate suitable database config type for database '${dbId}'`);

    ConfigUtil.assertExists('./db', configType);
    let configConst = require(configType);

    if (configConst.prototype instanceof IDatabase) {
        let dbc = new configConst(config.options);
        return dbc;
    }
    throw new Error(`Specified type ${configType} is not a valid database config`);
};

module.exports = IDatabase;
