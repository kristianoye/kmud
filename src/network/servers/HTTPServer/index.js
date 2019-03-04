/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: New and improved? HTTP daemon for KMUD
 */
const
    events = require('events'),
    http = require('http'),
    https = require('https'),
    path = require('path'),
    fs = require('fs');

const
    HTTPUri = require('./HTTPUri'),
    KnownMimeTypes = Object.assign({}, require('./KnownMimeTypes')),
    { HTTPRequest, HTTPResponse, HTTPContext } = require('./HTTPContext');

class HTTPServer extends events.EventEmitter {
    /**
     * Construct an HTTP Server instance.
     * @param {HttpServerOptions} config The server configuration
     */
    constructor(config) {
        super();
        /** @type {Object.<string,string>} */
        this.fileMappings = {};
        this.fileMappingNames = Object.keys(this.fileMappings);
        this.mimeTypes = Object.assign({}, KnownMimeTypes);
        this.port = config.port || 8088;
        this.portOptions = Object.assign(
            config.portOptions || {}, {
                host: '0.0.0.0',
                IncomingMessage: HTTPRequest,
                ServerResponse: HTTPResponse
            });
        this.securePort = config.securePort || false;
        this.secureOptions = config.secureOptions;
        this.staticRoot = config.staticRoot || path.join(__dirname, '../../../../lib/wwwroot');
    }

    /**
     * Add a virtual mapping 
     * @param {string} target Match this request path from the client.
     * @param {string} destination To this actual filesystem destination.
     * @returns {HTTPServer}
     */
    addMapping(target, destination) {
        if (target in this.fileMappings)
            throw new Error(`addMapping error: Location ${target} has already been mapped to ${this.fileMappings[target]}`);
        this.fileMappings[target] = destination;
        this.fileMappingNames = Object.keys(this.fileMappings).sort((a, b) => {
            return a.split('/').length > b.split('/').length ? -1 : 1;
        });
        return this;
    }

    /**
     * Adds an additional MIME type to those supported by the server.
     * @param {string} extension The extension (including the leading dot)
     * @param {string} type The MIME type (e.g. text/plain)
     * @param {string} text The descriptive name of the type
     */
    addMimeType(extension, type, text) {
        this.mimeTypes[extension] = { type, text };
        return this;
    }

    /**
     * Bind ports and listen for clients
     */
    bind() {
        if (typeof this.port === 'number' && this.port > 79 && this.port < 65000) {
            this.standardServer = http.createServer(
                this.portOptions,
                async (req, resp) => await this.receiveRequest(req, resp, this.standardServer));

            Object.assign(this.standardServer, {
                routeStaticContent: false,
                staticRoot: this.staticRoot
            });

            this.standardServer.listen(
                this.port,
                this.portOptions.host);
        }

        if (typeof this.securePort === 'number' && this.port > 442) {
            this.secureServer = https.createServer(
                this.secureOptions,
                this.receiveRequest);
        }
        return this;
    }

    /**
     * Render a static request.
     * @param {HTTPRequest} request
     * @param {HTTPResponse} response The server response
     */
    handleStaticRequest(request, response) {
        let url = request.urlParsed,
            localPath = url.localPath,
            stat = url.stat;

        if (!url.validLocation) {
            return this.sendErrorFile(response, 403);
        }

        let ext = !!localPath && localPath.slice(localPath.lastIndexOf('.')),
            mimeType = KnownMimeTypes[ext || 'unknown'] || false;

        if (!mimeType) {
            return this.sendErrorFile(response, 400);
        }

        let lastModified = request.headers["if-modified-since"];
        if (lastModified) {
            let lm = new Date(lastModified);
            if (lm && lm.getTime() >= parseInt(stat.mtimeMs)) {
                response.writeHead(304, 'Not Modified');
                return response.end();
            }
        }

        fs.readFile(localPath, (err, buff) => {
            if (!err) {
                response.writeHead(200, 'OK', {
                    'Content-Type': mimeType.type,
                    'Last-Modified': stat.mtime.toISOString()
                });
                response.write(buff);
                response.end();
            }
            else
                this.sendErrorFile(response, 500);
        });
    }

    /**
     * Maps the requested location to a physical location (if requesting static content)
     * @param {HTTPRequest} request The client request.
     */
    async mapLocation(request) {
        let url = request.url,
            urlParsed = request.urlParsed,
            physicalPath = path.join(this.staticRoot, urlParsed.absolutePath.slice(1));

        urlParsed.validLocation = physicalPath.startsWith(this.staticRoot);

        /*
         * Is this location mapped to a virtual location?
         */
        for (let i = 0, mapped = this.fileMappingNames, m = mapped.length; i < m; i++) {
            if (url.startsWith(mapped[i])) {
                let rightPart = url.slice(mapped[i].length);
                physicalPath = path.resolve(this.fileMappings[mapped[i]], rightPart);
                urlParsed.validLocation = true;
                break;
            }
        }

        let stat = await this.statFile(urlParsed.localPath = physicalPath);
        urlParsed.stat = stat;
        urlParsed.exists = stat.exists;
    }

    /** 
     * Process an HTTP connection
     * @param {HTTPRequest} request The client request
     * @param {HTTPResponse} response The server response
     */
    async receiveRequest(request, response, server) {
        try {
            let ctx = new HTTPContext(request, response);

            //  Resolve the physical path
            await this.resolveRequest(request, response, server);

            //  Does the request map to static content that exists?
            if (ctx.request.urlParsed.exists) {
                if (!this.routeStaticContent) {
                    return this.handleStaticRequest(request, response);
                }
            }

            //  Did resolve - 404
            return this.sendErrorFile(response, 404);

        }
        catch (err) {
            this.sendErrorFile(response, 500);
        }
        finally {
        }
    }

    /** 
     * Process an HTTP connection
     * @param {HTTPRequest} request The client request
     * @param {HTTPResponse} response The server response
     */
    async resolveRequest(request, response, server) {

        await HTTPUri.parse(request, async req => await this.mapLocation(req),
            request.connection.server instanceof https.Server);

        let url = request.urlParsed;

        if (url.stat.isDirectory()) {
            let indexPath = ['index.html', 'index.htm', 'index.cshtml']
                .map(s => {
                    return path.join(url.localPath, s);
                }).filter(fn => {
                    return fs.existsSync(fn);
                });

            if (indexPath.length === 0) {
                return this.sendErrorFile(response, 403);
            }
            url.stat = await this.statFile(url.localPath = indexPath[0]);
        }
        return true;
    }

    /**
     * Send an error message
     * @param {HTTPResponse} response The server response
     * @param {any} filename
     * @param {any} statusMessage
     * @param {any} statusCode
     */
    sendErrorFile(response, filename, statusMessage = 'Error', statusCode = 500) {
        if (typeof filename === 'number') {
            statusCode = filename;
            filename = `${filename}.html`;
        }
        let file = path.join(__dirname, 'errors', filename);
        let ext = file.slice(file.lastIndexOf('.'));
        let mimeType = KnownMimeTypes[ext];

        response.writeHead(statusCode || 500, statusMessage || 'Internal Server Error',
            { 'Content-Type': mimeType.type });

        fs.readFile(file, (err, buff) => {
            if (!err) {
                response.write(buff);
                response.end();
            }
        });
    }

    /**
     * 
     * @param {string} filename The name of the file to stat.
     * @returns {Promise<fs.Stats & { exists: boolean }>} The stats or a pseudo stat on failure.
     */
    async statFile(filename) {
        return new Promise((resolve, reject) => {
            try {
                fs.stat(filename, (err, stats) => {
                    if (err)
                        resolve({
                            exists: false,
                            isDirectory: () => false,
                            isFile: () => false,
                            isSocket: () => false,
                            error: err
                        });
                    else
                        resolve(Object.assign(stats, { exists: true }));
                });
            }
            catch (err) {
                reject({
                    exists: false,
                    isDirectory: () => false,
                    isFile: () => false,
                    isSocket: () => false,
                    error: err
                });
            }
        });
    }
}

module.exports = HTTPServer;
