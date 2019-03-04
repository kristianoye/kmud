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

const
    BaseContentHandler = require('./handlers/BaseContentHandler'),
    HandlerDefault = 'default',
    HandlerMVC = 'MVC';

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
        this.handlers = {};
        this.indexFiles = ['index.html', 'index.htm', 'index.mhtm'];
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

        this.addHandler(HandlerDefault, './handlers/StaticContentHandler')
            .addHandler(HandlerMVC, './handlers/MVCHandler')
            .addHandler('mhtm', './handlers/KMTemplateHandler');
    }

    /**
     * Adds a MIME handler
     * @param {string} mimeSpec The MIME type to handle
     * @param {string} modulePath The path to the module that will handle requests of this type.
     * @returns {HTTPServer}
     */
    addHandler(mimeSpec, modulePath) {
        let fullModulePath = path.join(__dirname, modulePath),
            handler = require(fullModulePath);

        if (handler instanceof BaseContentHandler === false &&
            handler.constructor instanceof BaseContentHandler.constructor === false)
            throw new Error(`No suitable handler for MIME spec '${mimeSpec}' found in module ${fullModulePath}`);

        if (typeof mimeSpec === 'string') {
            if (mimeSpec === HandlerDefault || mimeSpec === HandlerMVC) {
                this.handlers[mimeSpec] = handler;
            }
            else {
                let type = KnownMimeTypes.resolve(mimeSpec);

                if (Array.isArray(type)) {
                    type.forEach(m => {
                        this.handlers[m.extension] = handler;
                    });
                }
                else if (!type)
                    throw new Error(`Could not determine MIME type from '${$mimeSpec}'`);
                else
                    this.handlers[type.extension] = handler;
            }
        }
        return this;
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
     * Get a handler based on the request
     * @param {HTTPContext} context The request to create a handler for
     * @returns {BaseContentHandler} The handler to execute the request.
     */
    getHandler(context) {
        let request = context.request,
            urlParsed = request.urlParsed,
            handler = false;

        if (urlParsed.exists) {
            context.response.mimeType = KnownMimeTypes.resolve(urlParsed.extension);
            handler = this.handlers[urlParsed.extension] || this.handlers[HandlerDefault] || false;
        }
        else
            handler = this.handlers[HandlerMVC] || false;

        if (handler !== false) {
            //  Reusable handler
            if (typeof handler === 'object')
                return handler;

            //  One-time use handler
            else if (typeof handler === 'function')
                return new handler(this, context);

        }
        return false;
    }

    /**
     * Bind ports and listen for clients
     */
    start() {
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
     * Maps the requested location to a physical location (if requesting static content)
     * @param {HTTPRequest} request The client request.
     */
    async mapLocation(request) {
        let url = request.url,
            urlParsed = request.urlParsed,
            physicalPath = path.join(this.staticRoot, urlParsed.absolutePath.slice(1));

        urlParsed.validLocation = physicalPath.startsWith(this.staticRoot);

        //  Is this location mapped to a virtual location?
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

        //  If this is a directory then we will look for an index file
        //  TODO: Allow server option to render custom index view?
        if (urlParsed.exists && urlParsed.stat.isDirectory()) {
            let indexPath = this.indexFiles
                .map(s => path.join(url.localPath, s))
                .filter(fn => fs.existsSync(fn));

            if (indexPath.length === 0) {
                return this.sendErrorFile(response, 403);
            }
            url.stat = await this.statFile(url.localPath = indexPath[0]);
        }
    }

    /** 
     * Process an HTTP connection
     * @param {HTTPRequest} request The client request
     * @param {HTTPResponse} response The server response
     */
    async receiveRequest(request, response, server) {
        try {
            let context = new HTTPContext(request, response);

            //  Resolve the physical path
            if (await this.resolveRequest(context, server) === false)
                return this.sendErrorFile(response, 400);

            //  TODO: Add auth

            context.response.handler.executeHandler(context);
        }
        catch (err) {
            this.sendErrorFile(response, 500);
        }
        finally {
        }
    }

    /** 
     * Process an HTTP connection
     * @param {HTTPContext} context The current context
     */
    async resolveRequest(context, server) {
        let request = context.request;

        await HTTPUri.parse(request, async req => await this.mapLocation(req),
            request.connection.server instanceof https.Server);

        let handler = this.getHandler(context, server);

        if (handler === false)
            return false;

        context.response.handler = handler;

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

    /**
     * Read a file asyncronously
     * @param {string} filename The file to read.
     * @param {string} encoding Intrepret the buffer as this type of encoding (false for binary)
     */
    async readFile(filename, encoding = false) {
        return new Promise((resolve, reject) => {
            try {
                fs.readFile(filename, (err, content) => {
                    if (err)
                        reject(err);
                    else {
                        if (typeof encoding === 'string') {
                            content = content.toString(encoding);
                        }
                        resolve(content);
                    }
                });
            }
            catch (ex) {
                reject(ex);
            }
        });
    }

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
