/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Creates an endpoint that may be used by web-enabled clients (browsers)
 */
const { ExecutionContext, CallOrigin } = require('../../../ExecutionContext');
const
    ClientEndpoint = require('../../ClientEndpoint'),
    HTTPClientInstance = require('./HTTPClientInstance'),
    MudPort = require('../../../config/MudPort'),
    fs = require('fs'),
    HTTP = require('http'),
    URL = require('url'),
    Path = require('path');

const
    _server = Symbol('server');

function createHttpServer() {
    var httpServer = HTTP.createServer((req, resp) => {
        function processFileRequest(file) {
            var pos = file.lastIndexOf('.') + 1,
                ext = pos > 0 ? file.substr(pos).toLowerCase() : null;

            fs.readFile(file, (err, buff) => {
                if (err) {
                    resp.writeHead(500, 'Read Error', { 'Content-Type': 'text/html' });
                }
                else {
                    var contentTypes = {
                        css: 'text/css',
                        html: 'text/html',
                        htm: 'text/html',
                        ico: 'image/x-icon',
                        js: 'text/javascript',
                        jpg: 'image/jpeg',
                        mp3: 'audio/mpeg3',
                        ogg: 'audio/ogg',
                        png: 'image/png',
                        ts: 'text/typescript'
                    };
                    if (contentTypes[ext]) {
                        resp.writeHead(200, 'OK', { 'Content-Type': contentTypes[ext] });
                        resp.write(buff);
                    } else {
                        resp.writeHead(404, 'Not Found');
                    }
                }
                resp.end();
            });
        }

        var wwwroot = Path.resolve('./lib/wwwroot/'),
            ubase = URL.parse(req.url),
            reqpath = Path.resolve(wwwroot, ubase.pathname === '/' ? 'index.html' : ubase.pathname.slice(1));

        if (reqpath.indexOf(wwwroot) !== 0) {
            resp.writeHead(403, 'Forbidden', { 'Content-Type': 'text/html' });
            resp.end();
        }
        else {
            fs.stat(reqpath, (err, stat) => {
                if (err) {
                    resp.writeHead(404, 'Not Found', { 'Content-Type': 'text/html' });
                    resp.end();
                }
                else if (stat.isDirectory()) {
                    fs.stat(reqpath + '/index.html', function (_err, _stat) {
                        if (_err) {
                            resp.writeHead(404, { 'Content-Type': 'text/html' });
                            resp.end();
                        }
                        else if (_stat.isFile()) {
                            processFileRequest(reqpath + '/index.html');
                        }
                    });
                }
                else if (stat.isFile()) {
                    processFileRequest(reqpath);
                }
            });
        }
    });

    return httpServer;
}

class HTTPClientEndpoint extends ClientEndpoint {
    /**
     * Construct a new HTTP client endpoint.
     * @param {object} gameMaster The master object.
     * @param {MudPort} config The port configuration.
     */
    constructor(gameMaster, config) {
        super(gameMaster, config);
    }

    /**
     * Start listening to the specified port
     * @param {ExecutionContext} ecc The current callstack
     * @returns {HTTPClientEndpoint} Reference to self
     */
    bind(ecc) {
        let frame = ecc.push({ file: __filename, method: 'bind', callType: CallOrigin.Driver });
        try {
            this[_server] = createHttpServer();
            this.httpServer.listen({ port: this.port, host: this.address });
            this.httpServer.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    this.emit('error', error, this);
                }
            });

            this.WebSocket = require('socket.io')(this.httpServer, {
                log: true,
                transports: ['websocket']
            });

            this.WebSocket.on('connection', (client) => {
                let wrapper = new HTTPClientInstance(this, client);
                this.emit('kmud.connection', wrapper);
                this.emit('kmud.connection.new', wrapper, 'http');
            });
            return this;
        }
        finally {
            frame.pop();
        }
    }

    get httpServer() {
        return this[_server];
    }
}

module.exports = HTTPClientEndpoint;