/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides single interface for interacting with databases.
 */

const
    IDatabase = require('./IDatabase'),
    mysql = require('mysql');

class MySqlDb extends IDatabase {
    constructor(config) {
        super(config);
    }

    connect() {
        mysql.createConnection(this.options);
    }
}

module.exports = MySqlDb;
