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
                port: this.port,
                portOptions: { host: this.address }
            })
            .addMapping('/', path.join(__dirname, 'client/index.html'))
            .addMapping('/index.html', path.join(__dirname, 'client/index.html'))
            .addMapping('/css/', path.join(__dirname, 'client/css/'))
            .addMapping('/js/', path.join(__dirname, 'client/js/'))
            .on('upgrade', socket => {
                console.log('Client has requested to upgrade to websocket');
            })
            .bind();
        return this;
    }
}

module.exports = DesktopServer;
