/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: Placeholder for future MVC-based server.
 */

const
    ClientEndpoint = require('../../ClientEndpoint'),
    HTTPServer = require('../../servers/HTTPServer'),
    MudPort = require('../../../config/MudPort'),
    DesktopClient = require('./DesktopClient'),
    io = require('socket.io'),
    path = require('path');

class DesktopServer extends ClientEndpoint {
    /**
     * Construct a new HTTP client endpoint.
     * @param {object} gameMaster The master object.
     * @param {MudPort} config The port configuration.
     */
    constructor(gameMaster, config) {
        super(gameMaster, config);
    }

    bind() {
        this.server = new HTTPServer(
            {
                enableWebSocket: true,
                port: this.port,
                portOptions: { host: this.address }
            })
            .addMapping('/index.html', path.join(__dirname, 'client/index.html'))
            .addMapping('/desktop/', path.join(__dirname, 'client/desktop/'))
            .on('upgrade', socket => {
                console.log('Client has requested to upgrade to websocket');
            })
            .on('connection', client => {
                let wrapper = new DesktopClient(this, client);
                this.emit('kmud.connection', wrapper);
                this.emit('kmud.connection.new', wrapper, 'http');

            })
            .start();
        return this;
    }
}

module.exports = DesktopServer;
