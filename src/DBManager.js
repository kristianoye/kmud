/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides single interface for interacting with databases.
 */

const
    MUDEventEmitter = require('./MUDEventEmitter'),
    Database = require('./db/Database')

class DBManager extends MUDEventEmitter {
    /**
     * Initialize the database manager.
     * @param {Object.<string,Database>} config Collection of database entries
     */
    constructor(config) {
        super();

        /** @type {Object.<string,Database>} */
        this.connections = {};

        if (typeof config !== 'object')
            throw new Error(`Bad parameter 1 to DBManager constructor; Expected object got ${typeof config}`);

        Object.keys(config).forEach(db => {
            this.connections[db] = Database.create(db, config[db]);
        });
    }

    /**
     * Connect to the specified database.
     */
    connect(name) {
        let db = this.get(name || 'default');
        return db.connect();
    }

    /**
     * Get a database configuration.
     * @param {string=} dbname The name of the database to retrieve.
     * @returns {Database} The database configuration
     */
    get(dbname) {
        if (!dbname || typeof dbname !== 'string')
            throw new Error('Missing required string parameter: dbname');
        if (dbname in this.connections) {
            return this.connections[dbname];
        }
        throw new Error(`Database '${dbname}' was not found in configuration`);
    }
}

module.exports = DBManager;
