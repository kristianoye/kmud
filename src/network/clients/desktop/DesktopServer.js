/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: Placeholder for future MVC-based server.
 */

const { ExecutionContext, CallOrigin } = require('../../../ExecutionContext');
const
    DesktopFileAbstraction = require('./DesktopFileAbstraction'),
    ClientEndpoint = require('../../ClientEndpoint'),
    HTTPServer = require('../../servers/HTTPServer'),
    MudPort = require('../../../config/MudPort'),
    DesktopClient = require('./DesktopClient'),
    path = require('path');


class DesktopServer extends ClientEndpoint {
    /**
     * Construct a new HTTP client endpoint.
     * @param {object} gameMaster The master object.
     * @param {MudPort} config The port configuration.
     */
    constructor(gameMaster, config) {
        super(gameMaster, config);

        this.websocketOptions = Object.assign({
            pingInterval: 25000,
            pingTimeout: 60000
        }, config.options.websocket || {});

        this.#clients = {};
    }

    /**
     * 
     * @param {ExecutionContext} ecc
     * @returns
     */
    bind(ecc) {
        let frame = ecc.push({ file: __filename, method: 'bind', callType: CallOrigin.Driver });
        try {
            this.server = new HTTPServer(
                {
                    enableWebSocket: true,
                    port: this.port,
                    portOptions: {
                        host: this.address
                    },
                    websocketOptions: Object.assign({}, this.websocketOptions)
                })
                .createFileAbstraction(DesktopFileAbstraction)
                .addMapping('/index.html', path.join(__dirname, 'client/index.html'))
                .addMapping('/desktop/', path.join(__dirname, 'client/desktop/'))
                .on('upgrade', () => {
                    console.log('Client has requested to upgrade to websocket');
                })
                .on('connection', client => {
                    let { existing, client: instance } = this.#getOrCreateClient(client);

                    this.emit('kmud.connection', instance);

                    if (false === existing)
                        this.emit('kmud.connection.new', instance, 'http');
                    else
                        instance.bindClient(client);
                })
                .start();

            if (typeof driver.applyRegisterServer === 'function') {
                if (this.port > 0) {
                    driver.driverCall('applyRegisterServer', () => {
                        driver.applyRegisterServer(frame.branch(), {
                            address: this.address,
                            protocol: 'http',
                            port: this.port,
                            server: this.server
                        });
                    });
                }

                if (this.securePort > 0) {
                    driver.driverCall('applyRegisterServer', () => {
                        driver.registerServer(frame.branch(), {
                            address: this.address,
                            protocol: 'https',
                            port: this.securePort,
                            server: this.server
                        });
                    });
                }
            }
            return this;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Contains all desktop clients connected during this runtime
     * @type {Object.<string,DesktopClient>}
     */
    #clients;

    createAuthToken(username, password) {
        if (this.server.authManager != null)
            return this.server.authManager.create(username, password);
        return false;
    }

    decryptAuthToken(authToken) {
        if (this.server.authManager != null)
            return this.server.authManager.decrypt(authToken.auth);
        return false;
    }

    #getOrCreateClient(client) {
        let clientId = client.handshake?.query?.clientId;

        if (clientId in this.#clients)
            return { existing: true, client: this.#clients[clientId] };
        else
            return { existing: false, client: (this.#clients[clientId] = new DesktopClient(this, client, clientId)) };
    }
}

module.exports = DesktopServer;
