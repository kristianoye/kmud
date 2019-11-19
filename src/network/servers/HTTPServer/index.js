/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: New and improved? (IIS-inspired) HTTP daemon for KMUD
 */
const
    events = require('events'),
    http = require('http'),
    https = require('https'),
    path = require('path'),
    fs = require('fs');

const
    AuthManager = require('./AuthManager'),
    FileAbstraction = require('./FileAbstraction'),
    HTTPUri = require('./HTTPUri'),
    RouteTable = require('./RouteTable'),
    KnownMimeTypes = Object.assign({}, require('./KnownMimeTypes')),
    { HTTPRequest, HTTPResponse, HTTPContext } = require('./HTTPContext');

const
    BaseContentHandler = require('./handlers/BaseContentHandler'),
    HandlerDefault = 'default',
    HandlerMVC = 'MVC';


/**
 * @typedef {Object} HandlerConfig 
 * @property {string} module The module that will handle the Request.
 * @property {number} [order=0] The order in which the handler will be tried.
 * @property {string|RegExp} [path='*'] The path pattern that must be.
 * @property {string|number} [resourceType=3] The resource type that the handler applies to.
 * @property {string} [verb='*'] One ore more verbs to match.
 */

class HTTPHandlerEntry extends events.EventEmitter {
    /**
     * Construct a new handler.
     * @param {HTTPServer} server The server that owns this entry.
     * @param {HandlerConfig} config The handler configuration.
     */
    constructor(server, config) {
        super();

        this.module = config.module;
        this.order = config.order || 0;
        /** @type {string|RegExp} */
        this.path = config.path || '*';
        this.resourceType = config.resourceType || 'Unspecified';
        this.server = server;
        this.verb = config.verb || '*';

        if (this.verb.length > 1)
            this.verbs = this.verb.split(',').map(s => s.trim().toUpperCase());

        if (typeof this.path === 'string')
            this.path = new RegExp('^' + this.path.replace(/\./g, '\\.').replace(/\*/, '.*').replace(/\?/, '.') + '$');
    }

    /**
     * Returns an instance of the actual handler.
     * @returns {BaseContentHandler} 
     */
    getInstance() {
        if (!this.instance) {
            let module = require(this.module), instance = false;
            if (typeof module === 'object') {
                this.instance = instance = module;
            }
            else {
                instance = new module();
                if (instance.reusable)
                    this.instance = instance;
            }
            return instance;
        }
        return this.instance;
    }

    /**
     * Attempt to process a request
     * @param {HTTPContext} ctx The context to process
     * @returns {boolean} Returns true if the context was handled or false if not.
     */
    async processRequest(ctx) {
        let instance = this.getInstance();
        try {
            let result = await instance.executeHandler(ctx);
            return result !== false;
        }
        catch (err) {

        }
        return false;
    }

    /**
     * Check to see if this handler should try and process the request.
     * @param {HTTPContext} ctx The context to check
     * @returns {boolean} True if the handler should try and process the request.
     */
    tryRequest(ctx) {

        if (Array.isArray(this.verbs) && this.verbs.indexOf(ctx.request.method) === -1)
            return false;

        if (typeof this.path === 'object' && !this.path.test(ctx.request.url))
            return false;

        return true;
    }
}

class HTTPServer extends events.EventEmitter {
    /**
     * Construct an HTTP Server instance.
     * @param {HttpServerOptions} config The server configuration
     */
    constructor(config) {
        super();

        this.authManager = new AuthManager(config.authConfig);
        this.enableWebSocket = config.enableWebSocket === true;
        this.fileMappings = {};
        this.fileMappingNames = Object.keys(this.fileMappings);

        /** @type {HTTPHandlerEntry[]} */
        this.handlers = [];
        this.indexFiles = [];
        this.mimeTypes = Object.assign({}, KnownMimeTypes);
        this.port = config.port || 8088;
        this.portOptions = Object.assign(
            config.portOptions || {}, {
                host: '0.0.0.0',
                IncomingMessage: HTTPRequest,
                ServerResponse: HTTPResponse
            });

        this.routeTable = new RouteTable(this);
        this.securePort = config.securePort || false;
        this.secureOptions = config.secureOptions;
        this.contentRoot = config.staticRoot || path.join(__dirname, '../../../../lib/wwwroot');

        this.addHandler({ verbs: '*', module: './handlers/StaticContentHandler', path: '*' });
        this.addHandler({ verbs: '*', module: './handlers/KMTemplateHandler', path: '*.mhtml' });
        this.addHandler({ verbs: '*', module: './handlers/MVCHandler', path: '*' });

        this.fileSystem = new FileAbstraction.FileAbstractionDefault();
        this.websocketOptions = config.websocketOptions || {};
    }

    /**
     * Add one or more index filenames (e.g. index.htm, index.html, etc)
     * @param {...string} spec
     */
    addIndexFile(...spec) {
        spec.forEach(fn => {
            if (this.indexFiles.indexOf(fn) === -1)
                this.indexFiles.push(fn);
        });
        if (this.fileSystem)
            this.fileSystem.addIndexFile(...spec);
        return this;
    }

    /**
     * Adds a MIME handler
     * @param {{ server: HTTPServer, module: string, order: number, path: string, verbs: string }} config Info on the handler to add.
     * @returns {HTTPServer}
     */
    addHandler(config) {

        if (typeof config !== 'object')
            throw new Error('Bad argument 1 to addHandler');
        else if (typeof config.module !== 'string')
            throw new Error('Handler config is missing required property: module');
        else if (typeof config.verbs !== 'string')
            throw new Error('Handler config is missing required property: module');

        if (typeof config.order !== 'number')
            config.order = this.handlers.length;

        this.handlers.push(new HTTPHandlerEntry(this, config));
        this.handlers.sort((a, b) => a.order < b.order ? -1 : 1);

        //let fullModulePath = path.join(__dirname, modulePath),
        //    handler = require(fullModulePath);

        //if (handler instanceof BaseContentHandler === false &&
        //    handler.constructor instanceof BaseContentHandler.constructor === false)
        //    throw new Error(`No suitable handler for MIME spec '${mimeSpec}' found in module ${fullModulePath}`);

        //if (typeof mimeSpec === 'string') {
        //    if (mimeSpec === HandlerDefault || mimeSpec === HandlerMVC) {
        //        this.handlers[mimeSpec] = handler;
        //    }
        //    else {
        //        let type = KnownMimeTypes.resolve(mimeSpec);

        //        if (Array.isArray(type)) {
        //            type.forEach(m => {
        //                this.handlers[m.extension] = handler;
        //            });
        //        }
        //        else if (!type)
        //            throw new Error(`Could not determine MIME type from '${$mimeSpec}'`);
        //        else
        //            this.handlers[type.extension] = handler;
        //    }
        //}
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
        this.fileSystem.addMapping(target, destination);
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
     * Create a filesystem abstraction for the web server.
     * @param {FileAbstraction.FileAbstractionBase} fileSystemType The filesystem abstraction type to create
     */
    createFileAbstraction(fileSystemType) {
        if (fileSystemType) {
            this.fileSystem = new fileSystemType(this.contentRoot);

            this.fileSystem.addMapping(this.fileMappings);
            this.fileSystem.addIndexFile(...this.indexFiles);
        }
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

        context.response.mimeType = KnownMimeTypes.resolve(urlParsed.extension);
        if (urlParsed.exists) {
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
     * Maps the requested location to a physical location (if requesting static content)
     * @param {HTTPContext} context The current HTTP context.
     */
    async mapLocation(context) {
        let request = context.request,
            url = request.url,
            urlParsed = request.urlParsed,
            physicalPath = path.posix.join(this.contentRoot, urlParsed.absolutePath.slice(1));

        urlParsed.validLocation = physicalPath.startsWith(this.contentRoot);

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
                .map(s => path.posix.join(url, s))
                .map(async fn => await this.virtualPathExists(fn));

            await Promise.all(indexPath).then(values => {
                indexPath = values.filter(v => v !== false);
            });
            if (indexPath.length === 0) {
                return this.sendErrorFile(context.response, 403);
            }
            let [localFile, stat] = indexPath[0];
            urlParsed.stat = stat;
            urlParsed.localPath = localFile;
        }
        return true;
    }

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

    /** 
     * Process an HTTP connection
     * @param {HTTPRequest} request The client request
     * @param {HTTPResponse} response The server response
     */
    async receiveRequest(request, response, server) {
        try {
            let context = new HTTPContext(request, response);
            let loc = await this.resolvePath(request.url)

            context.server = this;

            context.request.urlParsed = HTTPUri.parse(context, server.isSecure);
            context.request.urlParsed.localPath = loc.physicalPath;
            context.request.urlParsed.stat = await loc.stat();

            for (let i = 0; i < this.handlers.length; i++) {
                let handler = this.handlers[i];
                if (handler.tryRequest(context)) {
                    if (await handler.processRequest(context) !== false) {
                        return;
                    }
                }
            }

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

    async resolveAction(url) {

    }

    /**
     * Map a virtual path to a physical path (that may or may not exist)
     * @param {string} expr The expression to evaluate.
     */
    async resolvePath(expr) {
        let resolvedFilename = this.fileSystem.createLocation(expr),
            stat = await resolvedFilename.stat();

        if (stat.isDirectory()) {
            for (let i = 0; i < this.indexFiles.length; i++) {
                let indexFile = resolvedFilename.resolveVirtual(this.indexFiles[i]);
                let indexStat = await indexFile.stat();

                if (indexStat.exists) {
                    return indexFile;
                }
            }
        }
        return resolvedFilename;
    }

    /** 
     * Process an HTTP connection
     * @param {HTTPContext} context The current context
     */
    async resolveRequest(context, server) {
        let request = context.request;

        let result = await HTTPUri.parse(context, async ctx => await this.mapLocation(ctx),
            request.connection.server instanceof https.Server);

        if (result === false)
            return false;

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
     * Set the static root
     * @param {any} siteRoot
     */
    setContentRoot(siteRoot) {
        this.contentRoot = siteRoot;
        return this;
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
                staticRoot: this.contentRoot
            });

            this.standardServer.isSecure = false;
            this.standardServer.listen(
                this.port,
                this.portOptions.host)
                .on('upgrade', (...args) => {
                    this.emit('upgrade', ...args);
                });

            if (this.enableWebSocket) {
                /** @type {SocketIO.ServerOptions} */
                let socketOptions = Object.assign({
                    log: true,
                    transports: ['websocket']
                }, this.websocketOptions);

                this.standardWebSocket = require('socket.io')(this.standardServer, {
                    log: true,
                    transports: ['websocket']
                });

                this.standardWebSocket.on('connection', client => {
                    this.emit('connection', client);
                });
            }
        }

        if (typeof this.securePort === 'number' && this.port > 442) {
            this.secureServer = https.createServer(
                this.secureOptions,
                this.receiveRequest);
            this.standardServer.isSecure = true;

        }
        return this;
    }

    /**
     * Stat a file on the filesystem.
     * @param {any} filename
     */
    async statFile(filename) {
        return new Promise((resolve, reject) => {
            try {
                fs.stat(filename, (err, stats) => {
                    if (err)
                        resolve(createDummyStats(err));
                    else
                        resolve(Object.assign(stats, { exists: true, error: false }));
                });
            }
            catch (err) {
                resolve(createDummyStats(err));
            }
        });
    }

    /**
     * Checks to see if the specified virtual path exists.
     * @param {string} virtualPath The virtual path to check
     * @returns {[string, fs.Stats]} Information about the alternate location
     */
    async virtualPathExists(virtualPath) {
        for (let i = 0, names = this.fileMappingNames, m = names.length; i < m; i++) {
            if (virtualPath.startsWith(names[i])) {
                let mapsTo = path.join(this.fileMappings[names[i]], virtualPath.slice(names[i].length));
                let stats = await this.statFile(mapsTo);
                if (stats.exists) {
                    return [mapsTo, stats];
                }
            }
        }
        return false;
    }

    /**
     * Do stuff with the routing table (helper callback)
     * @param {any} doAction
     */
    withRoutes(doAction = false) {
        if (typeof doAction === 'function')
            try {
                doAction(this.routeTable);
            }
            catch (err) {
                throw err;
            }
        return this;
    }
}

/**
 * @param {Error} err The error that occurred
 * @returns {fs.Stats & { exists: false, error: Error }}
 */
function createDummyStats(err = false, fullPath = undefined) {
    let dt = new Date(0),
        alwaysFalse = () => false;

    return {
        atime: dt,
        atimeMs: dt.getTime(),
        birthtime: dt,
        birthtimeMs: dt.getTime(),
        blksize: 4096,
        blocks: 0,
        ctime: dt,
        ctimeMs: dt.getTime(),
        dev: -1,
        error: err || new Error('Unknown error'),
        exists: false,
        fullPath,
        gid: -1,
        ino: -1,
        nlink: -1,
        uid: -1,
        mode: -1,
        mtime: dt,
        mtimeMs: dt.getTime(),
        size: -1,
        rdev: -1,
        isBlockDevice: alwaysFalse,
        isCharacterDevice: alwaysFalse,
        isDirectory: alwaysFalse,
        isFIFO: alwaysFalse,
        isFile: alwaysFalse,
        isSocket: alwaysFalse,
        isSymbolicLink: alwaysFalse
    };
}

module.exports = HTTPServer;
