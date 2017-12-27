/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const ClientEndpoint = require('./ClientEndpoint'),
    Telnet = require('./RanvierTelnet'),
    TelnetServer = Telnet.TelnetServer,
    TelnetSocket = Telnet.TelnetSocket,
    MudPort = require('../config/MudPort'),
    RanvierTelnetInstance = require('./RanvierTelnetInstance'),
    _connections = Symbol('_connections');

class RanvierTelnetEndpoint extends ClientEndpoint {
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
     * @returns {RanvierTelnetEndpoint} A reference to itself
     */
    bind() {
        let self = this;

        let server = new TelnetServer((socket) => {
            let opts = { maxInputLength: this.config.maxCommandLength || 80 };
            let client = new TelnetSocket().attach(socket);
            let wrapper = new RanvierTelnetInstance(self, self.gameMaster, client);

            self.emit('kmud.connection.new', client, 'telnet');
            self.emit('kmud.connection', wrapper);
        });
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                this.emit('error', error, this);
            }
        });
        server.netServer.listen(this.port, this.address);
        return this;
    }
}

Object.defineProperty(RanvierTelnetEndpoint.prototype, 'connections', {
    get: function () { return this[_connections]; },
    set: function () { },
    enumerable: true,
    configurable: true
});

module.exports = RanvierTelnetEndpoint;
