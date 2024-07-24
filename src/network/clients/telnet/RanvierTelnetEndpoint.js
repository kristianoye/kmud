const { ExecutionContext, CallOrigin } = require('../../../ExecutionContext');

/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides basic telnet connectivity for text-based clients
 * (also potentially provides MSP, compression, etc, depending on client)
 */
const
    ClientEndpoint = require('../../ClientEndpoint'),
    Telnet = require('./RanvierTelnet'),
    TelnetServer = Telnet.TelnetServer,
    TelnetSocket = Telnet.TelnetSocket,
    MudPort = require('../../../config/MudPort'),
    RanvierTelnetInstance = require('./RanvierTelnetInstance');

class RanvierTelnetEndpoint extends ClientEndpoint {
    /**
     * 
     * @param {any} gameMaster The game master object
     * @param {MudPort} config The configuration
     */
    constructor(gameMaster, config) {
        super(gameMaster, config);
    }

    /**
     * Binds the telnet port and listens for clients.
     * @param {ExecutionContext} ecc The current callstack
     * @returns {RanvierTelnetEndpoint} A reference to itself
     */
    bind(ecc) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'bind', callType: CallOrigin.Driver });
        try {
            let server = new TelnetServer(async socket => {
                let client = new TelnetSocket(this.options)
                    .attach(socket);
                let wrapper = new RanvierTelnetInstance(this, client);

                await wrapper.connect();

                this.emit('kmud.connection.new', client, 'telnet');
                this.emit('kmud.connection', wrapper);
            });
            server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    this.emit('error', error, this);
                }
            });
            server.netServer.listen(this.port, this.address);
            return this;
        }
        finally {
            frame.pop();
        }
    }
}

module.exports = RanvierTelnetEndpoint;
