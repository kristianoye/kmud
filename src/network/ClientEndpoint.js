/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const
    EventEmitter = require('events'),
    MudPort = require('../config/MudPort');

class ClientEndpoint extends EventEmitter {
    /**
     *
     * @param {GameServer} gameMaster The game master object.
     * @param {MudPort} config The port configuration.
     */
    constructor(gameMaster, config) {
        super();

        this.address = config.address || '0.0.0.0';
        this.config = config;
        this.connections = [];
        this.maxConnections = config.maxConnections;
        this.port = config.port;
        this.type = config.type;

        this.connections = [];
        this.gameMaster = gameMaster;

        /** @type {Object.<string,any>} */
        this.options = config.options || {};
    }

    /**
     * @returns {ClientEndpoint} Reference to self
     */
    bind() {
        throw new Error(`bind() is not implemented in type ${this.constructor.name}`);
    }
}

module.exports = ClientEndpoint;