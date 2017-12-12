/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const EventEmitter = require('events');

const _connections = Symbol('connections'),
    _gameMaster = Symbol('gameMaster'),
    _maxConnections = Symbol('maxConnections'),
    _port = Symbol('port');

var endpointData = {};

class ClientEndpoint extends EventEmitter {
    /**
     * 
     * @param {number} port The TCP port the endpoint listens to.
     * @param {number} maxConnections The maximum number of active connections on this port.
     */
    constructor(gameMaster, port, maxConnections) {
        super();

        this[_connections] = [];
        this[_gameMaster] = gameMaster;
        this[_maxConnections] = maxConnections;
        this[_port] = port;
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