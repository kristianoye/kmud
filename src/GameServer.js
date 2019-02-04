﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDConfig = require('./MUDConfig'),
    ExecutionContext = require('./ExecutionContext'),
    { NetUtil, NetworkInterface } = require('./network/NetUtil'),
    async = require('async'),
    MXC = require('./MXC');

const
    fs = require('fs'),
    path = require('path'),
    os = require('os'),
    MUDEventEmitter = require('./MUDEventEmitter');

const
    FileSecurity = require('./FileSecurity'),
    FileManager = require('./FileManager'),
    MUDStorage = require('./MUDStorage');

var
    Instance,
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
        this.masterFilename = config.mudlib.master.path;
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

            var privateNetworks = [
                [NetUtil.ip4toint('10.0.0.0'), NetUtil.ip4toint('10.255.255.255')],
                [NetUtil.ip4toint('192.168.0.0'), NetUtil.ip4toint('192.168.255.255')],
                [NetUtil.ip4toint('172.16.0.0'), NetUtil.ip4toint('172.31.255.255')]
            ];

            _addressList.sort((a, b) => {
                let na = NetUtil.ip4toint(a), nb = NetUtil.ip4toint(b);
                for (let i = 0; i < privateNetworks.length; i++) {
                    let [min, max] = privateNetworks[i];

                    if (na >= min && na <= max) {
                        if (nb >= min && nb <= max)
                            return na < nb ? -1 : na === nb ? 0 : 1;
                        return i;
                    }
                }
                return na < nb ? -1 : na === nb ? 0 : 1;
            });
            return _addressList.length ? _addressList[0] : '127.0.0.1';
        }

        //this.serverAddress = determineDefaultAddress.call(this);

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
     * @param {Error} e The error to sanitize.
     * @param {boolean} sdf Show external frames
     * @returns {Error} The cleaned up error.
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
        let config = this.config.mudlib;

        let gameMaster = this.compiler.compileObject(config.master.path);
        if (!gameMaster) {
            throw new Error('In-game master could not be loaded; Abort!');
        }

        /** @type {MasterObject} */
        this.masterObject = gameMaster.getInstance(0);

        if (!this.masterObject) {
            throw new Error(`Failed to load master object (${config.master.path})`);
        }

        let locateApply = (name, required) => {
            let func = this.masterObject[config.applyNames[name] || name];
            if (typeof func !== 'function' && required === true)
                throw new Error(`Invalid master object; Could not locate required ${name} apply: ${(config.applyNames[name] || name)}`);
            return func || false;
        };

        /* validate in-game master */
        this.applyErrorHandler = locateApply.call(this, 'errorHandler', false);
        this.applyGetPreloads = locateApply.call(this, 'getPreloads', false);
        this.applyLogError = locateApply.call(this, 'logError', false);
        this.applyValidExec = locateApply.call(this, 'validExec', false);
        this.applyValidObject = locateApply.call(this, 'validObject', false);
        this.applyValidRead = locateApply.call(this, 'validRead', true);
        this.applyValidRequire = locateApply.call(this, 'validRequire', true);
        this.applyValidSocket = locateApply.call(this, 'validSocket', false);
        this.applyValidShutdown = locateApply.call(this, 'validShutdown', true);
        this.applyValidWrite = locateApply.call(this, 'validWrite', true);

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
        this.driverCall('createPreloads', ecc => {
            ecc.alarmTime = Number.MAX_SAFE_INTEGER;
            if (this.applyGetPreloads !== false) {
                this.preloads = this.applyGetPreloads.apply(this.masterObject);
            }
            if (this.preloads.length > 0) {
                logger.logIf(LOGGER_PRODUCTION, 'Creating preloads.');
                this.preloads.forEach(file => {
                    let t0 = new Date().getTime(), foo = false;
                    try {
                        foo = Array.isArray(file) ?
                            this.compiler.compileObject({ file: file[0], args: file.slice(1) }) :
                            this.compiler.compileObject({ file });
                    }
                    catch (err) {
                        /* do nothing atm */
                    }
                    finally {
                        let t1 = new Date().getTime();
                        logger.logIf(LOGGER_DEBUG,
                            `\tPreload: ${file}: ${(file, foo ? '[OK]' : '[Failure]')} [${(t1 - t0)} ms; ${ecc.stack.length}]`);
                    }
                });
            }
        });
    }

    /**
     * Create an efuns instance for the specified module.
     * @param {string} fileName The filename to create an efuns object for.
     * @returns {EFUNProxy} The file-specific efun proxy object.
     */
    createEfunInstance(fileName) {
        let module = this.cache.get(fileName) || false;
        if (module && module.efuns)
            return module.efuns;
        if (fileName === this.simulEfunPath) {
            let efunType = require('./EFUNProxy');
            return module.efuns = new efunType(fileName);
        }
        let efuns = this.simulEfunType && new this.simulEfunType(fileName);
        if (efuns) {
            Object.freeze(efuns);
            return module.efuns = efuns;
        }
        return false;
    }

    /**
     * Create the simul efuns object.
     * @returns {EFUNProxy} The sealed simul efun object.
     */
    createSimulEfuns() {
        let EFUNProxy = require('./EFUNProxy');

        //  For bootstrapping
        //if (!this.efuns) {
        //    let sp = this.simulEfunPath;
        //    this.efuns = new EFUNProxy(sp.slice(0, sp.lastIndexOf('/')), sp);
        //    this.simulEfunType = require('./EFUNProxy');
        //}
        //else
        {
            try {
                if (this.simulEfunPath) {
                    let module = this.compiler.compileObject({
                        file: this.simulEfunPath,
                        noCreate: true,
                        altParent: require('./EFUNProxy'),
                        noSeal: true
                    });
                    this.simulEfunType = module.getType();
                }
            }
            catch (err) {
                // Oh snap... fallback plan...
                this.simulEfunType = require('./EFUNProxy');
            }
            finally {
                Object.seal(this.simulEfunType);
                this.efuns = new this.simulEfunType('/', '/');
                this.efuns.SaveExtension = this.config.mudlib.defaultSaveExtension;
                Object.freeze(this.efuns);
            }
        }
        return this.efuns;
    }

    /**
     * Configure the various components attached to the driver.
     */
    configureRuntime() {
        try {
            let
                ClientInstance = require('./network/ClientInstance'),
                MUDCache = require('./MUDCache'),
                MUDCompiler = require('./MUDCompiler'),
                EFUNProxy = require('./EFUNProxy'),
                MUDModule = require('./MUDModule'),
                MUDStorage = require('./MUDStorage'),
                MUDLoader = require('./MUDLoader');

            MUDObject = require('./MUDObject');
            EFUNProxy.configureForRuntime();
            MUDCompiler.configureForRuntime(this);
            MUDLoader.configureForRuntime(this);
            MUDModule.configureForRuntime(this);
            ClientInstance.configureForRuntime(this);
            MUDStorage.configureForRuntime(this);

            global.MUDObject = MUDObject;
            this.cache = new MUDCache();
            this.compiler = new MUDCompiler(this, this.config.driver.compiler);

            global.unwrap = function (target, success, hasDefault) {
                let result = false, defaultValue = hasDefault || false,
                    onSuccess = typeof success === 'function' && success || function (s) {
                        return s;
                    };
                if (typeof target === 'function' && target.isWrapper === true) {
                    result = target();
                    if (!(result instanceof MUDObject)) result = defaultValue;
                }
                else if (typeof target === 'object' && target instanceof MUDObject) {
                    result = target;
                }
                return result && onSuccess(result);
            };

            global.wrapper = function (o) {
                if (typeof o === 'function' && o.isWrapper === true)
                    return o;
                else if (typeof o === 'object' && typeof o.wrapper === 'function')
                    return o.wrapper;
                return false;
            };

            require('./MUDCache').configureForRuntime(this);
        }
        catch (err) {
            console.log(err.message);
            console.log(err.stack);
            throw err;
        }
    }

    driverCall(method, callback) {
        let ecc = this.getExecution(this, method, '(driver)', false, 0);
        try {
            return callback(ecc);
        }
        catch (err) {
            console.log(`Error in ${method}`, err);
        }
        finally {
            ecc.pop(method);
        }
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
     * @param {boolean} flag A flag indicating whether global error handler is enabled.
     * @returns {GameServer} A reference to the game server.
     */
    enableGlobalErrorHandler(flag) {
        this.globalErrorHandler = flag === true;
        return this;
    }

    /**
     * Let the in-game master possibly handle an exception.
     * @param {Error} err The exception that must be handled.
     * @param {boolean} caught Indicates whether the exception was caught elsewhere.
     */
    errorHandler(err, caught) {
        if (this.applyErrorHandler) {
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
            this.applyErrorHandler.call(this.masterObject, error, caught);
        }
    }

    /**
     * Switch an interactives body
     * @deprecated
     * @param {MUDObject} oldBody Original body the interactive user is leaving.
     * @param {MUDObject} newBody The new body the interactive user is switching to.
     * @param {ClientInstance} client The client instance 
     * @param {function(MUDObject,MUDObject):any} callback A callback that fires when the exec is completed.
     * @returns {boolean} True if the operation was successful.
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
                    obj.heartbeat(this.heartbeatInterval, this.heartbeatCounter);
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
     * @param {string} note An optional note to include in the execution context.
     * @returns {MXC} Returns the current execution context.
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
     * Fetch the current execution context.
     * 
     * @param {any} ob The current object
     * @param {any} method The current method
     * @param {any} fileName The current filename
     * @param {boolean} isAsync Was the call async?
     * @param {number} lineNumber The line number the call originated on.
     * @returns {ExecutionContext} The context.
     */
    getExecution(ob, method, fileName, isAsync, lineNumber) {
        if (arguments.length === 0)
            return this.executionContext || false;

        if (!this.executionContext) {
            this.executionContext = new ExecutionContext();
        }
        return this.executionContext.push(ob, method, fileName, isAsync, lineNumber);
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
     * @param {string} path The file to write logs to.
     * @param {Error} error The error to log.
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
     * @param {MUDObject} simul The efuns defined within the mudlib source tree.
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
     * @param {MUDObject} ob The object that contains a reset() method.
     * @param {number} resetTime The time at which the next reset should occur.
     * @param {MUDStorage} $storage The storage object associated with the object.
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

            resetTime = Math.floor((resetTime / 5000) * 5000);
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
     * @param {MUDObject} body Remove a living object from the list maintained by the game.
     * @returns {boolean} Returns true if the living item existed in the list and was removed.
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
     * @returns {boolean} True if the player was removed successfully.
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
     * @param {function(MUDConfig):void} callback Callback to execute when the MUD is running.
     * @returns {GameServer} A reference to the GameServer.
     */
    async run(callback) {
        let nets = await NetUtil.discoveryAsync()
            .catch(err => { throw new Error(`Could not start GameServer: ${err}`); }),
            list = nets.filter(n => n.internetAccess);

        if (list.length === 0)
            throw new Error('Could not start GameServer: No suitable network interfaces');
        this.serverAddress = list[0].address;

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
        return this;

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
                .on('kmud.connection', client => {
                    this.driverCall('onConnection', () => {
                        let ctx = client.createContext(client.createCommandEvent(false));
                        let newLogin = this.masterObject.connect(client.port);
                        if (newLogin) {
                            driver.storage.get(newLogin).setProtected('$client', client,
                                ($storage, _client) => {
                                    let evt = {
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
                    });
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
        let ecc = this.getExecution(this.masterObject, 'onReady', this.masterObject.filename);
        this.gameState = GAMESTATE_RUNNING;
        try {
            this.masterObject.emit('ready', this.masterObject);
        }
        catch (err) {
            /* do nothing */
        }
        finally {
            ecc.pop('onReady');
        }
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
            if (this.gameState < GAMESTATE_INITIALIZING) return true;
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
     * @param {ExecutionFrame} frame Contains a single frame to validate
     * @param {string} path The file that is to be read.
     */
    validRead(efuns, frame, path) {
        if (this.gameState < GAMESTATE_RUNNING)
            return true;
        else if (frame.object === driver)
            return true;
        else if (frame.object === driver.masterObject)
            return true;
        else
            return this.applyValidRead.call(this.masterObject, path, frame.object || frame.file, frame.method);
    }

    validRequire(efuns, moduleName) {
        return true;
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
