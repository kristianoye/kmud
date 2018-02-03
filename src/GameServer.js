﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDConfig = require('./MUDConfig'),
    async = require('async'),
    stack = require('callsite'),
    MXC = require('./MXC'),
    merge = require('merge');

const
    fs = require('fs'),
    path = require('path'),
    os = require('os'),
    ClientEndpoint = require('./network/ClientEndpoint'),
    ClientInstance = require('./network/ClientInstance'),
    MUDEventEmitter = require('./MUDEventEmitter');

const
    FileSecurity = require('./FileSecurity'),
    FileManager = require('./FileManager'),
    Extensions = require('./Extensions'),
    MUDStorage = require('./MUDStorage'),
    MUDLogger = require('./MUDLogger');

var
    Instance,
    MUDCompiler,
    MUDObject,
    ResetInterval = 1000 * 60 * 60 * 2,
    UseLazyResets = false;

class GameServer extends MUDEventEmitter {
    /**
     * Construct a new game server
     * @param {MUDConfig} config The configuration object.
     */
    constructor(config) {
        super();

        global.driver = Instance = this;

        /** @type {MUDConfig} */
        this.config = config;

        ResetInterval = config.mudlib.objectResetInterval;
        UseLazyResets = config.driver.useLazyResets;


        if (!this.config) {
            throw new Error('FATAL: GameServer created without configuration!');
        }

        if (!(this.gameState = GAMESTATE_STARTING))
            throw new Error('Unable to set game state!');

        this.connections = [];
        this.currentContext = false;
        this.currentVerb = '';
        this.efunProxyPath = path.resolve(__dirname, './EFUNProxy.js');
        /** @type {EFUNProxy} */
        this.efuns = null;
        this.simulEfunPath = config.mudlib.simulEfuns;

        this.startTime = new Date().getTime();

        this.addressList = { '127.0.0.1': true };
        this.endpoints = [];

        /** @type {FileManager} */
        this.fileManager = null;
        this.heartbeatCounter = 0;
        this.heartbeatInterval = config.mudlib.heartbeatInterval;
        /** @type {MUDObject[]} */
        this.heartbeatObjects = [];
        this.heartbeatStorage = {};
        this.includePath = config.mudlib.includePath || [];
        /** @type {MUDObject[]} */
        this.livings = [];
        this.logDirectory = config.mudlib.logDirectory;
        this.masterFilename = config.mudlib.inGameMaster.path;
        this.mudName = config.mud.name;
        this.nextResetTime = 0;

        /** @type {MUDObject} */
        this.players = [];
        this.preCompilers = [];
        this.preloads = [];
        this.resetStack = [];
        this.resetTimes = {};

        /** @type {FileSecurity} */
        this.securityManager = null;

        function determineDefaultAddress() {
            var _addressList = [],
                _defaultAddress,
                _ifaces = os.networkInterfaces();

            Object.keys(_ifaces).forEach((ifname) => {
                var alias = 0;

                _ifaces[ifname].forEach((iface) => {
                    if ('IPv4' !== iface.family || iface.internal !== false) {
                        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                        return;
                    }

                    if (alias >= 1) {
                        // this single interface has multiple ipv4 addresses
                        logger.log(ifname + ':' + alias, iface.address);
                    } else {
                        // this interface has only one ipv4 adress
                        logger.log(ifname, iface.address);
                        _addressList.push(iface.address);
                        this.addressList[iface.address] = true;
                    }
                    ++alias;
                });
            });

            _addressList.sort((a, b) => {
                if (a.startsWith('192.')) {
                    if (b.startsWith('192.'))
                        return a < b ? -1 : a === b ? 0 : 1;
                    return 2;
                }
                else if (a.startsWith('10.')) {
                    if (b.startsWith('10.'))
                        return a < b ? -1 : a === b ? 0 : 1;
                    return 1;
                }
                return a < b ? -1 : a === b ? 0 : 1;
            });
            return _addressList.length ? _addressList[0] : '127.0.0.1';
        }
        this.serverAddress = determineDefaultAddress.call(this);

        this.endpoints = config.mud.portBindings.map(binding => {
            logger.logIf(LOGGER_DEBUG, () => `Adding ${binding.type} ${binding.address} port ${binding.port}`);
            var endpointConfig = config.driver.networking.endpoints.getEndpointConfig(binding.type),
                handlerConfig = endpointConfig.getHandler(binding.handlerType || false),
                handlerModule = require(handlerConfig.file),
                handlerType = handlerConfig.type ? handlerModule[handlerConfig.type] : handlerModule,
                endpoint = new handlerType(this, binding.mergeOptions(handlerConfig.options));

            endpoint.on('error', (error, failedEndpoint) => {
                if (error.code === 'EADDRINUSE') {
                    logger.logIf(LOGGER_PRODUCTION, () =>
                        `Port Error: ${failedEndpoint.name} reports address+port already in use (game already running?)`);
                    process.exit(-111);
                }
            });

            return endpoint;
        });
    }

    addLiving(body) {
        return unwrap(body, living => {
            let w = living.wrapper,
                n = this.livings.indexOf(w);
            if (n === -1) {
                this.livings.push(w);
                return true;
            }
            return false;
        });
    }

    addPlayer(body) {
        return unwrap(body, player => {
            if (typeof player.save === 'function') {
                let w = player.wrapper,
                    n = this.players.indexOf(w);
                if (n === -1) {
                    this.players.push(w);
                    return true;
                }
                return false;
            }
        });
    }

    /**
     * Removes absolute paths from a stack trace if possible.
     * @param {Error} e
     * @param {boolean} sdf Show external frames
     */
    cleanError(e, sdf) {
        if (e.clean)
            return e;
        let s = e.stack,
            l = s.split('\n'),
            mp = this.fileManager.mudlibAbsolute,
            dp = this.config.driver.driverPath,
            showDriverFrames = sdf || this.config.driver.showDriverFrames,
            mpl = mp.length,
            v = /[a-zA-Z0-9\\\/\._]/,
            newStack = [];

        while (!l[0].match(/^\s+at /)) {
            newStack.push(l.shift());
        }

        l.forEach(t => {
            let s1 = t.indexOf('(') + 1, s2 = t.lastIndexOf(')'),
                info = t.slice(s1, s2),
                parts = info.split(':'),
                file = parts.length > 3 ? parts.splice(0, parts.length - 2).join(':') : parts.shift(),
                line = parts.shift(),
                col = parts.shift(),
                mudPath = file && driver.fileManager.toMudPath(file);
            if (mudPath) {
                newStack.push(t.slice(0, s1) + `${mudPath}:${line}:${col}` + t.slice(s2));
            }
            else if (showDriverFrames === true) {
                if (file.startsWith(dp)) {
                    file = file.replace(dp, '[driver]');
                    newStack.push(t.slice(0, s1) + `${file}:${line}:${col}` + t.slice(s2));
                }
            }
        });
        e.stack = newStack.join('\n');
        e.clean = true;
        return e;
    }

    createMasterObject() {
        let config = this.config.mudlib, self = this,
            startupArgs = {
                args: merge({
                    driver: this,
                    resolver: driver.fileManager.toRealPath
                }, config.inGameMaster.parameters)
            };

        let _inGameMaster = this.compiler.compileObject({
            file: config.inGameMaster.path,
            reload: false,
            args: startupArgs
        });
        if (!_inGameMaster) {
            throw new Error('In-game master could not be loaded; Abort!');
        }
        this.masterWrapper = _inGameMaster.getWrapper(0);
        /** @type {MasterObject} */
        this.masterObject = _inGameMaster.instances[0];

        function locateApply(name, required) {
            let func = self.masterObject[config.applyNames[name] || name];
            if (typeof func !== 'function' && required === true)
                throw new Error(`Invalid master object; Could not locate required ${name} apply: ${(config.applyNames[name] || 'validRead')}`);
            return func || false;
        }

        /* validate in-game master */
        this.applyErrorHandler = locateApply('errorHandler', false);
        this.applyGetPreloads = locateApply('getPreloads', false);
        this.applyLogError = locateApply('logError', false);
        this.applyValidExec = locateApply('validExec', false);
        this.applyValidObject = locateApply('validObject', false);
        this.applyValidRead = locateApply('validRead', true);
        this.applyValidSocket = locateApply('validSocket', false);
        this.applyValidShutdown = locateApply('validShutdown', true);
        this.applyValidWrite = locateApply('validWrite', true);

        this.rootUid = typeof this.masterObject.get_root_uid === 'function' ?
            this.masterObject.get_root_uid() || 'ROOT' : 'ROOT';

        this.backboneUid = typeof this.masterObject.get_backbone_uid === 'function' ?
            this.masterObject.get_backbone_uid() || 'BACKBONE' : 'BACKBONE';

        return this;
    }

    /**
     * Initializes the filesystem.
     */
    createFileSystems() {
        let fsconfig = this.config.mudlib.fileSystem;

        logger.logIf(LOGGER_PRODUCTION, 'Creating filesystem(s)');
        this.fileManager = fsconfig.createFileManager(this);
        fsconfig.eachFileSystem(config => this.fileManager.createFileSystem(config));
    }

    /**
     * Preload some common objects to decrease in-game load times while running.
     */
    createPreloads() {
        let mxc = this.getContext(true, init => {
            init.alarm = Number.MAX_SAFE_INTEGER; // new Date().getTime() +  (60 * 2 * 1000);
            init.addFrame(this.masterObject, 'createPreloads');
        }, 'createPreloads');

        try {
            mxc.restore();
            if (this.applyGetPreloads !== false) {
                this.preloads = this.applyGetPreloads.apply(this.masterObject);
            }
            if (this.preloads.length > 0) {
                logger.logIf(LOGGER_PRODUCTION, 'Creating preloads.');
                this.preloads.forEach((file, i) => {
                    let ctx = mxc.clone(init => {
                        init.note = `Preloading ${file}`;
                    });
                    try {
                        ctx.restore();
                        var t0 = new Date().getTime();
                        var foo = Array.isArray(file) ?
                            this.compiler.compileObject({ file: file[0], args: file.slice(1) }) :
                            this.compiler.compileObject({ file });
                        var t1 = new Date().getTime();
                        logger.logIf(LOGGER_DEBUG, `\tPreload: ${file}: ${(file, foo ? '[OK]' : '[Failure]')} [${(t1 - t0)} ms]`);
                    }
                    finally {
                        ctx.release();
                    }
                });
            }
        }
        finally {
            mxc.release();
        }
    }

    /**
     * Create the simul efuns object.
     */
    createSimulEfuns(filename, mudpath) {
        if (filename) {
            let efuns = new this.simulEfunType();
            Object.defineProperties(efuns, {
                directory: {
                    value: mudpath,
                    writable: false,
                    enumerable: true
                },
                filename: {
                    value: filename,
                    writable: false,
                    enumerable: true
                },
                homeDirectory: {
                    value: '',
                    writable: false,
                    enumerable: true
                },
                permissions: {
                    value: [],
                    writable: false,
                    enumerable: true
                }
            });
            return Object.seal(efuns);
        }
        else {
            if (this.simulEfunPath) {
                let module = this.compiler.compileObject({
                    file: this.simulEfunPath,
                    noCreate: true,
                    altParent: require('./EFUNProxy'),
                    noSeal: true
                });
                Object.seal(module.classRef);
                this.simulEfunType = module.classRef;
            }
        }
    }

    /**
     * Configure the various components attached to the driver.
     */
    configureRuntime() {
        const
            ClientInstance = require('./network/ClientInstance'),
            MUDCache = require('./MUDCache'),
            MUDCompiler = require('./MUDCompiler'),
            EFUNProxy = require('./EFUNProxy'),
            MUDModule = require('./MUDModule'),
            MUDStorage = require('./MUDStorage'),
            MUDLoader = require('./MUDLoader');

        MUDObject = require('./MUDObject');
        EFUNProxy.configureForRuntime(this);
        MUDCompiler.configureForRuntime(this);
        MUDLoader.configureForRuntime(this);
        MUDModule.configureForRuntime(this);
        ClientInstance.configureForRuntime(this);
        MUDStorage.configureForRuntime(this);

        global.MUDObject = MUDObject;
        this.cache = new MUDCache();
        this.compiler = new MUDCompiler(this, this.config.driver.compiler);

        global.unwrap = function (target, success) {
            var result = false;
            if (typeof target === 'function' && target._isWrapper === true) {
                result = target() instanceof MUDObject ? target() : false;
            }
            else if (typeof target === 'object' && target instanceof MUDObject) {
                result = target;
            }
            return result === false ? false : (success ? success.call(this, result) : result);
        };

        global.wrapper = function (_o) {
            if (typeof _o === 'function' && _o._isWrapper === true) return _w;
            else if (typeof _o === 'object' && typeof _o.wrapper === 'function') return _o.wrapper;
            else if (_o instanceof MUDObject) {
                throw new Error('wrapper() failed');
            }
            return false;
        };

        require('./MUDCache').configureForRuntime(this);
    }

    /**
     * Expand the functionality of the driver by loading additional functionality.
     */
    enableFeatures() {
        const
            MUDObject = require('./MUDObject'),
            EFUNProxy = require('./EFUNProxy');

        logger.logIf(LOGGER_DEBUG, 'Bootstrap: Initializing driver features');
        this.features = this.config.driver.forEachFeature((featureConfig, pos, id) => {
            if(featureConfig.enabled) {
                logger.logIf(LOGGER_PRODUCTION, `\tEnabling driver feature: ${featureConfig.name}`);
                let feature = featureConfig.initialize();

                feature.createMasterApplies(this.masterObject, this.masterObject.constructor.prototype);
                feature.createObjectApplies(MUDObject.prototype);
                feature.createExternalFunctions(EFUNProxy.prototype);
                feature.createDriverApplies(this, this.constructor.prototype);

                feature.initialize(this, this.masterObject);

                return feature;
            }
            else {
                logger.logIf(LOGGER_DEBUG, `\tSkipping disabled feature: ${featureConfig.name}`);
            }
            return false;
        }).filter((feature) => feature !== false);

        this.preCompilers = this.features.filter((feature) => typeof feature.preCompile === 'function');
    }

    /**
     * Trap unhandled errors to prevent possible game crashes.
     */
    enableGlobalErrorHandler() {
        this.globalErrorHandler = true;
        return this;
    }

    /**
     * Let the in-game master possibly handle an exception.
     * @param {Error} err
     * @param {boolean} caught
     */
    errorHandler(err, caught) {
        if (this.applyErrorHandler) {
            let mxc = this.getContext();
            this.cleanError(err);
            let error = {
                error: err.message,
                program: '',
                object: null,
                line: 0,
                stack: err.stack,
                trace: []
            }, firstFrame = true;
            error.trace = err.stack.split('\n').map((line, index) => {
                let parts = line.split(/\s+/g).filter(s => s.length);
                if (parts[0] === 'at') {
                    let func = parts[1].split('.'), inst = null;
                    if (typeof parts[2] !== 'string') {
                        return false;
                    }
                    let [filename, line, cindex] = parts[2].slice(0, parts[2].length - 1).split(':');

                    if (filename.indexOf('.') === -1) {
                        let fparts = filename.split('#'),
                            module = this.cache.get(fparts[0]);
                        if (module) {
                            inst = module.instances[fparts.length === 2 ? parseInt(fparts[1]) : 0];
                        }
                    }
                    let frame = {
                        character: cindex,
                        file: filename,
                        function: func.pop(),
                        line: line,
                        object: inst,
                        program: func.length === 0 ? '[null]' : func.join('.')
                    };
                    if (firstFrame) {
                        error.character = frame.character;
                        error.file = frame.file;
                        error.function = frame.function;
                        error.line = frame.line;
                        error.object = inst;
                        error.program = frame.program;
                        firstFrame = false;
                    }
                    return frame;
                }
            }).filter(f => typeof f === 'object');
            if (mxc) {
                mxc.snooze(2000);
                if (mxc.input) {
                    mxc.input.complete();
                }
            }
            this.applyErrorHandler.call(this.masterObject, error, caught);
        }
    }

    /**
     * Switch an interactives body
     * @deprecated
     * @param {any} oldBody
     * @param {any} newBody
     * @param {any} client
     * @param {any} callback
     */
    exec(oldBody, newBody, client, callback) {
        var result = false;
        try {
            if (driver.connections.indexOf(client) > -1) {
                result = client.setBody(newBody);
                if (result && typeof callback === 'function')
                    callback.call(oldBody, newBody);
            }
        }
        catch (e) {
            result = false;
        }
        return true;
    }

    /**
     * Periodically call heartbeat on all applicable objects in the game.
     */
    executeHeartbeat() {
        try {
            let heartbeatStart = new Date(),
                maxExecTime = this.config.driver.maxCommandExecutionTime,
                failed = [];
            async.forEachOfLimit(this.heartbeatObjects, this.heartbeatLimit || 10, (obj, index, itr) => {
                let prev = this.currentContext,
                    $storage = this.heartbeatStorage[index],
                    mxc = this.getContext(true, init => {
                        init.alarm = heartbeatStart + maxExecTime;
                        init.note = 'heartbeat';
                        init.$storage = $storage;
                        init.thisPlayer = obj;
                        init.truePlayer = obj;
                        init.client = $storage.client;
                        init.addFrame(obj, 'heartbeat');
                    });
                try {
                    mxc.restore();
                    obj.eventHeartbeat(this.heartbeatInterval, this.heartbeatCounter);
                }
                catch (err) {
                    failed.push(obj);
                }
                finally {
                    mxc.release();
                    this.currentContext = prev;
                    itr();
                }
            }, err => {
                let timing = new Date().getTime() - heartbeatStart.getTime();
                if (timing > 1000) {
                    logger.log(`\tWARNING: Last heartbeat cycle took ${timing}ms`);
                }
                this.heartbeatCounter++;
                this.heartbeatTimer = setTimeout(() => {
                    this.executeHeartbeat();
                }, this.heartbeatInterval);
            });
        }
        catch (err) {
            //  TODO: This should be a game-crasher
            logger.log('Error in executeHeartbeat: ' + err);
            this.errorHandler(err, false);
        }
    }

    extendGlobals() {
        global.Array.prototype.pushDistinct = function (...list) {
            list.forEach(e => {
                var n = this.indexOf(e);
                if (n === -1) this.push(e);
            });
            return this;
        };
    }

    getAddress() {
        return this.serverAddress;
    }

    /**
     * Returns the currently executing context.
     * @param {boolean} createNew Force the creation of a new context.
     * @param {function(MXC):void} init A context initializing callback.
     * @returns {MXC}
     */
    getContext(createNew, init, note) {
        if (typeof createNew === 'boolean') {
            if (createNew || !this.currentContext) {
                return this.currentContext = new MXC(false, [], init, note);
            }
            else {
                return this.currentContext = this.currentContext.clone(init, note);
            }
        }
        return this.currentContext;
    }

    /**
     * Returns the name of the MUD.
     * @returns {string} The name of the MUD.
     */
    getMudName() {
        return this.config.mud.name;
    }

    inGroup(target, groups) {
        if (this.gameState < GAMESTATE_RUNNING) return true;
        else return driver.masterObject.inGroup(target, [].slice.call(arguments, 1));
    }

    isVirtualPath(path) {
        return this.virtualPrefix ? path.startsWith(this.virtualPrefix) : false;
    }

    /**
     * Allow the in-game master object to handle an error.
     * @param {any} path
     * @param {any} error
     */
    logError(path, error) {
        if (!this.applyLogError) {
            logger.log('Compiler Error: ' + error.message);
            logger.log(error.stack);
        }
        else this.applyLogError.apply(this.masterObject, arguments);
    }

    /**
     * Allow the in-game simul efuns to extend the efuns object.  This
     * should actually be the other way around.  The in-game efuns should
     * inherit the driver's efuns to allow for overrides.
     * @param {any} simul
     */
    mergeEfuns(simul) {
        if (simul) {
            let wrapper = simul.wrapper;
            let proto = simul.constructor.prototype;
            let EFUNProxy = require('./EFUNProxy');

            Object.getOwnPropertyNames(proto).forEach(function (method) {
                if (typeof proto[method] !== 'function') return;
                if (method === 'constructor') return;
                (function (name, impl) {
                    if (Reflect.has(EFUNProxy.prototype, name)) {
                        Reflect.deleteProperty(EFUNProxy.prototype, name);
                    }
                    try {
                        Object.defineProperty(EFUNProxy.prototype, name, {
                            value: function (...args) {
                                return wrapper()[name].apply(this, args);
                            }
                        });
                    }
                    catch (x) {
                        logger.log('Error merging efuns: ' + x);
                    }
                })(method, proto[method]);
            });
        }
    }

    preCompile(module) {
        this.preCompilers.forEach((pre) => pre.preCompile(module));
        return true;
    }

    /**
     * Register the time at which an object should reset.
     * @param {MUDObject} ob
     * @param {number=} resetTime
     * @param {MUDStorage=} $storage
     */
    registerReset(ob, resetTime, $storage) {
        if (typeof ob().reset === 'function') {
            if (!resetTime) {
                resetTime = new Date().getTime() + ResetInterval / 2 + Math.random(ResetInterval / 2);
            }
            if (!$storage) {
                $storage = driver.storage.get(ob);
            }
            let prev = $storage.resetTime;

            resetTime = Math.floor(resetTime / 5000 * 5000);
            $storage.nextReset = resetTime;

            if (prev > 0 && prev in this.resetTimes) {
                let n = this.resetTimes[prev].indexOf(ob);
                if (n > -1) this.resetTimes[prev].splice(n, 1);
            }

            if (!UseLazyResets) {
                let newEntry = false,
                    list = this.resetTimes[resetTime] ||
                        (newEntry = true, this.resetTimes[resetTime] = []),
                    stack = this.resetStack;

                if (newEntry) {
                    Array.prototype.push.call(stack, resetTime);
                    stack.sort((a, b) => a < b ? -1 : 1);
                }
                list.push(ob);
            }
        }
    }

    /**
     * Removes a living object from the list of living objects.
     * @param {MUDObject} body
     * @returns {boolean}
     */
    removeLiving(body) {
        return unwrap(body, living => {
            let index = this.livings.indexOf(living);
            if (index > -1) {
                this.players = this.livings.splice(index, 1);
                return true;
            }
            return false;
        });
    }

    /**
     * Remove a player from the list of active players.
     * @param {MUDObject} body The player to remove.
     */
    removePlayer(body) {
        return unwrap(body, player => {
            let index = this.players.indexOf(player);
            if (index > -1) {
                this.players = this.players.splice(index, 1);
                return true;
            }
            return false;
        });
    }

    /**
     * 
     * @param {MXC} ctx
     */
    restoreContext(ctx) {
        if (ctx && ctx.released)
            ctx = false;
        this.currentContext = ctx;
        this.thisPlayer = ctx && ctx.thisPlayer;
        this.truePlayer = ctx && ctx.truePlayer;
        this.currentVerb = (ctx && ctx.currentVerb) || '';
        this.objectStack = (ctx && ctx.objectStack) || [];
        return ctx;
    }

    /**
     * Runs the MUD
     * @param {function?} callback Callback to execute when the MUD is running.
     * @returns {GameServer} A reference to the GameServer.
     */
    run(callback) {
        if (!this.loginObject) {
            throw new Error('Login object must be specified');
        }
        logger.log('Starting %s', this.mudName.ucfirst());
        if (this.globalErrorHandler) {
            process.on('uncaughtException', err => {
                logger.log(err);
                logger.log(err.stack);
                this.errorHandler(err, false);
            });
        }
        this.createFileSystems();
        this.configureRuntime();

        let mxc = this.getContext(true, init => {
            init.note = 'Loading driver and efuns';
            init.onDestroy = (ctx) => {
                this.runStarting();
            };
        });

        try {
            mxc.restore();
            this.createSimulEfuns();
            this.createMasterObject();
            this.enableFeatures();
            this.sealProtectedTypes();
        }
        catch (err) {
            logger.log(err.message);
        }
        finally {
            mxc.release();
        }
    }

    runStarting() {
        this.gameState = GAMESTATE_STARTING;
        this.createPreloads();
        if (this.config.skipStartupScripts === false) {
            let runOnce = path.resolve(__dirname, '../runOnce.json');
            if (fs.existsSync(runOnce)) {
                let list = this.config.stripBOM(fs.readFileSync(runOnce, 'utf8'))
                    .split('\n')
                    .map(s => JSON.parse(s));
                try {
                    let $storage = this.storage.get(this.masterObject);
                    $storage.emit('kmud', {
                        eventType: 'runOnce',
                        eventData: list
                    });
                    logger.log(`Run once complete; Removing ${runOnce}`);
                    fs.unlinkSync(runOnce);
                }
                catch (err) {
                    logger.log(`Error running runOnce.json: ${err.message}`);
                }
            }
        }
        for (let i = 0; i < this.endpoints.length; i++) {
            this.endpoints[i]
                .bind()
                .on('kmud.connection', (client) => {
                    var ctx = client.createContext(client.createCommandEvent(''));
                    var newLogin = this.efuns.cloneObject(this.config.mudlib.loginObject);
                    if (newLogin) {
                        driver.storage.get(newLogin).setProtected('$client', client,
                            ($storage, _client) => {
                                var evt = {
                                    newBody: newLogin,
                                    newStorage: driver.storage.get(newLogin),
                                    client: _client
                                };
                                client.handleExec(evt);
                            });
                        if (driver.connections.indexOf(client) === -1)
                            driver.connections.push(client);
                    }
                    else {
                        client.writeLine('Sorry, something is very wrong right now; Please try again later.');
                        client.close('No Login Object Available');
                    }
                })
                .on('kmud.connection.new', function (client, protocol) {
                    logger.log(`New ${protocol} connection from ${client.remoteAddress}`);
                    driver.connections.push(client);
                })
                .on('kmud.connection.closed', function (client, protocol) {
                    logger.log(`${protocol} connection from ${client.remoteAddress} closed.`);
                    driver.connections.removeValue(client);
                })
                .on('kmud.connection.full', function (c) {
                    c.write('The game is all full, sorry; Please try again later.\n');
                    c.close();
                })
                .on('kmud.connection.timeout', function (c, p) {
                    logger.log('A %s connection from %s timed out', p, c.remoteAddress);
                });
        }
        if (typeof callback === 'function') callback.call(this);
        var startupTime = new Date().getTime() - this.startTime, startSeconds = startupTime / 1000;
        logger.log(`Startup took ${startSeconds} seconds [${startupTime} ms]`);
        this.runMain();
    }

    runMain() {
        this.gameState = GAMESTATE_RUNNING;

        if (this.config.mudlib.heartbeatInterval > 0) {
            this.heartbeatTimer = setTimeout(() => {
                this.executeHeartbeat();
            }, this.config.mudlib.heartbeatInterval);
        }

        if (this.config.mudlib.objectResetInterval > 0 && this.config.driver.useLazyResets === false) {
            this.resetTimer = setInterval(() => {
                let n = 0;
                for (let i = 0, now = new Date().getTime(); i < this.resetStack.length; i++) {
                    let timestamp = this.resetStack[i],
                        list = this.resetTimes[timestamp];

                    if (timestamp > 0 && timestamp < now) {
                        list.forEach((item, index) => {
                            unwrap(item, (ob) => {
                                try {
                                    let $storage = driver.storage.get(ob);
                                    if ($storage.nextReset < now) {
                                        ob.reset();
                                        this.registerReset(item, false);
                                    }
                                }
                                catch (resetError) {
                                    // Do not re-register reset--now disabled for previous object.
                                    this.errorHandler(resetError, false);
                                }
                            });
                        });
                        delete this.resetTimes[timestamp];
                        n++;
                        continue;
                    }
                    break;
                }
                //  This requires revisiting.  Use real stack and pop to avoid grossness like this.
                if (n > 0) this.resetStack.splice(0, n);
            }, MUDConfig.driver.resetPollingInterval);
        }
        return this;
    }

    /**
     * Try to make sure no evil code tries to redefine important in-game security features..
     */
    sealProtectedTypes() {
        let MUDObject = require('./MUDObject');
        Object.freeze(this.masterObject);
        Object.freeze(this.masterObject.constructor);
        Object.freeze(this.masterObject.constructor.prototype);
        Object.freeze(MUDObject.prototype);
        Object.freeze(MUDObject.constructor.prototype);
    }

    setLoginObject(path) {
        this.loginObject = path;
        return this;
    }

    setServerAddress(addr) {
        if (!this.addressList[addr])
            throw new Error('Specified address ({0}) is not available; Possible choices are {1}'
                .fs(addr, Object.keys(this.addressList).join(', ')));
        this.serverAddress = addr;
        return this;
    }

    setHeartbeatInterval(delay) {
        this.heartbeatInterval = delay;
        return this;
    }

    serverInfo() {
        return {
            'architecture': os.arch(),
            'cpus': os.cpus().map(function (cpu) {
                return [cpu.model, '@', cpu.speed].join('');
            }),
            'os build': os.type(),
            'os uptime': os.uptime()
        };
    }

    /**
     * Set the active player
     * @param {MUDObject} body
     * @param {MUDObject} truePlayer
     * @param {string} verb
     */
    setThisPlayer(body, truePlayer, verb) {
        return unwrap(body, player => {
            if (typeof truePlayer === 'string') {
                verb = truePlayer;
                truePlayer = false;
            }

            this.thisPlayer = player;
            if (truePlayer === true) this.truePlayer = player;
            this.currentVerb = verb || '';
        });
    }

    setVirtualPrefix(path) {
        this.virtualPrefix = path;
        return this;
    }

    unguarded(callback, thisObject, args) {
        this.efuns.unguarded(() => {
            return callback.apply(thisObject || this, args || []);
        });
    }

    validExec(oldBody, newBody) {
        if (this.gameState < GAMESTATE_RUNNING)
            return false;
        else if (this.applyValidExec === false) return true;
        else return this.applyValidExec.apply(this.masterObject, arguments);
    }

    validObject(arg) {
        let result = unwrap(arg, ob => {
            if (ob.filename === this.simulEfunPath) {
                this.createSimulEfuns();
                return true;
            }
            else if (this.gameState <  GAMESTATE_INITIALIZING)
                return true;
            else if (this.applyValidObject === false) return true;
            else return this.applyValidObject.apply(this.masterObject, arguments);
        });
        return result !== false;
    } 

    /**
     * Get the MUD uptime.
     * @returns {number} The game uptime in milliseconds.
     */
    uptime() {
        return new Date().getTime() - this.startTime;
    }

    /**
     * Checks to see if the current permissions stack can read the config.
     * @param {any} caller
     * @param {any} key
     * @returns {boolean} Returns true if the read operation should be permitted.
     */
    validReadConfig(caller, key) {
        if (this.gameState < GAMESTATE_RUNNING)
            return true;
        else if (!this.applyValidReadConfig) return true;
        else return this.masterObject.validReadConfig(caller, key);
    }

    /**
     *
     * @param {EFUNProxy} efuns Contains the filename of the originating call
     * @param {MXCFrame} frame Contains a single frame to validate
     * @param {string} path The file that is to be read.
     */
    validRead(efuns, frame, path) {
        if (this.gameState < GAMESTATE_RUNNING)
            return true;
        else if (efuns.filename === '/')
            return true;
        else if (efuns.filename === this.masterFilename)
            return true;
        else
            return this.applyValidRead.call(this.masterObject, path, frame.object || frame.file, frame.func);
    }

    /**
     * Checks to see if a shutdown request is valid.
     * @returns {boolean} Returns true if the shutdown may proceed.
     */
    validShutdown(efuns) {
        if (this.gameState !== GAMESTATE_RUNNING)
            return true;
        else if (!this.applyValidShutdown)
            return true;
        else
            return this.masterObject.validShutdown(efuns);
    }

    /**
     * Check to see if a write operation should be permitted.
     * @param {EFUNProxy} efuns Contains the filename of the originating call
     * @param {MXCFrame} frame Contains a single frame to validate
     * @param {string} path The file that is to be written to.
     */
    validWrite(efuns, frame, path) {
        if (this.gameState < GAMESTATE_INITIALIZING)
            return true;
        else if (efuns.filename === '/')
            return true;
        else if (efuns.filename === this.masterFilename)
            return true;
        else
            return this.applyValidWrite.call(this.masterObject, path, frame.object || frame.file, frame.func);
    }
}

/**
 * @returns {GameServer} The dreiver instance. */
GameServer.get = function () {
    return Instance;
};

module.exports = GameServer;
