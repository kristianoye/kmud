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
    _config = Symbol('config'),
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
        this[_config] = config;
        this[_connections] = [];
        this[_gameMaster] = gameMaster;
        this[_maxConnections] = config.maxConnections;
        this[_port] = config.port;
        this[_type] = config.type;

        this.connections = [];
        this.gameMaster = gameMaster;

        /** @type {Object.<string,any>} */
        this.options = config.options || {};
    }

    get address() {  return this[_address];  }

    get config() { return this[_config]; }

    get maxConnections() {  return this[_maxConnections];  }

    get name() {  return `Binding: ${this.type}://${this.address}:${this.port}`; }

    get port() {  return this[_port]; }

    get type() {  return this[_type];  }

    /**
     * @returns {ClientEndpoint} Reference to self
     */
    bind() { return this; }
}

module.exports = ClientEndpoint;