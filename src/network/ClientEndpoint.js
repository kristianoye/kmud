/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const
    EventEmitter = require('events'),
    MudPort = require('../config/MudPort'),
    MUDEventEmitter = require('../MUDEventEmitter');


const
    _address = Symbol('address'),
    _connections = Symbol('connections'),
    _gameMaster = Symbol('gameMaster'),
    _maxConnections = Symbol('maxConnections'),
    _port = Symbol('port'),
    _type = Symbol('type');

var endpointData = {};

class ClientEndpoint extends EventEmitter {
    /**
     *
     * @param {GameServer} gameMaster The game master object.
     * @param {MudPort} config The port configuration.
     */
    constructor(gameMaster, config) {
        super();

        this[_address] = config.address || '0.0.0.0';
        this[_connections] = [];
        this[_gameMaster] = gameMaster;
        this[_maxConnections] = config.maxConnections;
        this[_port] = config.port;
        this[_type] = config.type;
    }

    get address() {
        return this[_address];
    }

    get connections() {
        return this[_connections];
    }

    get gameMaster() {
        return this[_gameMaster];
    }

    get maxConnections() {
        return this[_maxConnections];
    }

    get name() {
        return `Binding: ${this.type}://${this.address}:${this.port}`;
    }

    get port() {
        return this[_port];
    }

    get type() {
        return this[_type];
    }

    /**
     * @returns {ClientEndpoint} Reference to self
     */
    bind() { return this; }
}

module.exports = ClientEndpoint;