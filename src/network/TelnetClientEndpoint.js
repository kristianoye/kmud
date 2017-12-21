/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const ClientEndpoint = require('./ClientEndpoint'),
    Telnet = require('telnet'),
    TelnetClientInstance = require('./TelnetClientInstance'),
    MudPort = require('../config/MudPort'),
    _connections = Symbol('_connections');

class TelnetClientEndpoint extends ClientEndpoint {
    /**
     * 
     * @param {any} gameMaster
     * @param {MudPort} config
     */
    constructor(gameMaster, config) {
        super(gameMaster, config);
        this[_connections] = [];
    }

    /**
     * Binds the telnet port and listens for clients.
     * @returns {TelnetClientEndpoint} A reference to itself
     */
    bind() {
        var self = this;
        Telnet.createServer(function (client) {
            var wrapper = new TelnetClientInstance(self, self.gameMaster, client);
            self.emit('kmud.connection.new', client, 'telnet');
            self.emit('kmud.connection', wrapper);

            if (self.connections.length >= self.maxConnections) {
                self.emit('kmud.connection.full', wrapper);
            }
            else {
                wrapper.on('kmud.connection.closed', function (c) {
                    self.connections.removeValue(c);
                });
                self.connections.push(wrapper);
            }
        }).listen(this.port);

        return this;
    }
}

Object.defineProperty(TelnetClientEndpoint.prototype, 'connections', {
    get: function () { return this[_connections]; },
    set: function () { },
    enumerable: true,
    configurable: true
});

module.exports = TelnetClientEndpoint;
