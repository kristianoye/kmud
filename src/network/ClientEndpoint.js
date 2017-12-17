﻿/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const
    EventEmitter = require('events'),
    { MUDConfigPort } = require('../MUDConfig');


const
    _address = Symbol('address'),
    _connections = Symbol('connections'),
    _gameMaster = Symbol('gameMaster'),
    _maxConnections = Symbol('maxConnections'),
    _port = Symbol('port');

var endpointData = {};

class ClientEndpoint extends EventEmitter {
    /**
     *
     * @param {GameServer} gameMaster The game master object.
     * @param {MUDConfigPort} config The port configuration.
     */
    constructor(gameMaster, config) {
        super();

        this[_address] = config.address || '0.0.0.0';
        this[_connections] = [];
        this[_gameMaster] = gameMaster;
        this[_maxConnections] = config.maxConnections;
        this[_port] = config.port;
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

    get port() {
        return this[_port];
    }

    /**
     * @returns {ClientEndpoint} Reference to self
     */
    bind() { return this; }
}

module.exports = ClientEndpoint;