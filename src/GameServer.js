﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    { ExecutionContext, ExecutionFrame, CallOrigin } = require('./ExecutionContext'),
    { NetUtil } = require('./network/NetUtil'),
    { LinkedList, LinkedListWithID, LinkedListWithLookup } = require('./LinkedList'),
    MUDObject = require('./MUDObject'),
    SimpleObject = require('./SimpleObject'),
    CompilerFlags = require('./compiler/CompilerFlags'),
    async = require('async');


const
    fs = require('fs'),
    path = require('path'),
    os = require('os'),
    uuidv5 = require('uuid/v5'),
    events = require('events');

class GameServer extends events.EventEmitter {
    /**
     * Construct a new game server
     * @param {MUDConfig} config The configuration object.
     */
    constructor(config) {
        super();

        global.driver = this;
        this.debugMode = true;

        let extensionsDir = path.join(__dirname, 'extensions');
        Object.defineProperty(global, '__ivc', {
            value: false,
            writable: false,
            configurable: false
        });
        fs.readdirSync(extensionsDir).forEach(file => {
            try {
                let fullPath = path.join(__dirname, 'extensions', file);
                let exportList = require(fullPath);
                if (exportList != null) {
                    if (typeof exportList === 'object') {
                        Object.keys(exportList).forEach(key => {
                            console.log(`Importing ${key} into global namespace`);
                            global[key] = exportList[key];
                        });
                    }
                    else if (typeof exportList === 'function')
                        global[exportList.name] = exportList;
                }
            }
            catch (ex) {
                console.log(`Error including extension file ${file}: ${ex.message}\n` + ex.stack);
            }
        });
        let test = Math.floor(1.2);
        this.efunProxyPath = path.resolve(__dirname, './EFUNProxy.js');

        /** @type {EFUNProxy} */
        let efunType = require('./EFUNProxy');
        this.initDriverEfuns(new efunType('/'));
        this.startTime = efuns.ticks;

        /** @type {MUDConfig} */
        this.config = config;
        /** @type {ExecutionContext} */
        this.executionContext = false;

        this.resetInterval = config.mudlib.objectResetInterval || (3600 * 30); // Default to 30 minutes
        this.useLazyResets = config.driver.useLazyResets || false;

        if (!this.config) {
            throw new Error('FATAL: GameServer created without configuration!');
        }

        if (!(this.gameState = GAMESTATE_STARTING))
            throw new Error('Unable to set game state!');

        this.connections = [];
        /** @type {ExecutionContext} */
        this.currentContext = false;
        this.currentVerb = '';
        this.simulEfunPath = config.mudlib.simulEfuns;

        this.addressList = { '127.0.0.1': true };
        this.endpoints = [];

        /** @type {FileManager} */
        this.fileManager = null;
        this.heartbeatCounter = 0;
        this.heartbeatInterval = config.mudlib.heartbeatInterval;

        /*
         *  Important collections maintained by the driver
         */
        this.heartbeatObjects = new LinkedList();
        this.interactiveObjects = new LinkedList();
        this.livingObjects = new LinkedListWithLookup('livingName');
        this.playerObjects = new LinkedListWithID('playerName');
        this.wizardObjects = new LinkedListWithID('playerName');

        //  Locations where #include and require look for unqualified files
        this.includePath = config.mudlib.includePath || [];

        this.logDirectory = config.mudlib.logDirectory;
        this.masterFilename = config.mudlib.master.path;
        this.mudName = config.mud.name;
        this.website = config.mud.website || 'http://localhost/';
        this.nextResetTime = 0;

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
            if (binding.wizardsOnly)
                logger.logIf(LOGGER_DEBUG, () => `Adding ${binding.type} ${binding.address} port ${binding.port} [WIZARD ONLY; max: ${binding.maxConnections}]`);
            else
                logger.logIf(LOGGER_DEBUG, () => `Adding ${binding.type} ${binding.address} port ${binding.port} [open port; max: ${binding.maxConnections}]`);

            let handlerModule = require(binding.server),
                endpoint = new handlerModule(this, binding);

            endpoint.on('error', (error, failedEndpoint) => {
                try {
                    if (error.code === 'EADDRINUSE') {
                        logger.logIf(LOGGER_PRODUCTION, () =>
                            `Port Error: ${failedEndpoint.name} reports address+port already in use (game already running?)`);
                        process.exit(-111);
                    }
                }
                catch (ex) {
                    logger.log(`Error binding endpoint: ${ex.message}`);
                }
            });

            return endpoint;
        });
    }

    /**
     * 
     * @param {typeof MUDObject | string} player The player object to get a home path for
     * @returns 
     */
    getHomePath(player) {
        return unwrap(player, user => {
            if (this.applyGetHomePath) {
                return this.driverCall(this.applyGetHomePath.name, () => {
                    return this.applyGetHomePath(player);
                });
            }
            return undefined;
        });
    }

    getNewId() {
        return uuidv5(this.website, uuidv5.URL);
    }

    /**
     * 
     * @param {LinkedList} collection The collection to maintain
     * @param {string} prop The storage property used to track index
     * @param {MUDStorageContainer} store  The MUD storage object
     * @param {boolean} enabled The desired state of object (true it is added, false it is removed)
     */
    maintainCollection(collection, prop, store, enabled) {
        let id = store[prop],
            isSet = id !== false && collection.hasKey(id),
            hashKey = false;

        if (!enabled && !isSet) // No harm, no foul
            return true;
        else if (collection instanceof LinkedListWithID) {
            hashKey = store[collection.hashKey];
            if (!hashKey) throw new Error(`Object could not be added to collection [Missing required key '${collection.hashKey}']`);
        }

        if (enabled && !isSet) {
            store[prop] = collection.add(store);
            return true;
        }
        else if (!enabled && isSet) {
            collection.remove(id);
            store[prop] = false;
            return true;
        }
    }

    setHeartbeat(store, enabled) {
        return this.maintainCollection(this.heartbeatObjects, 'heartbeatIndex', store, enabled);
    }

    setInteractive(store, enabled) {
        return this.maintainCollection(this.interactiveObjects, 'interactiveIndex', store, enabled);
    }

    setLiving(store, enabled = false) {
        return this.maintainCollection(this.livingObjects, 'livingIndex', store, enabled);
    }

    setPlayer(store, enabled = false) {
        return this.maintainCollection(this.playerObjects, 'playerIndex', store, enabled);
    }

    setWizard(store, enabled = false) {
        return this.maintainCollection(this.wizardObjects, 'wizardIndex', store, enabled);
    }

    async bootstrapSecurity() {
        return await this.driverCallAsync('bootstrapSecurity', async () => {
            return await this.fileManager.bootstrapSecurity(this.masterObject);
        }, undefined, true);
    }

    /**
     * Call an apply in the master object and return the result
     * @param {ExecutionContext} ecc The current callstack
     * @param {string | function} applyName The name of the apply to call
     * @param {...any} args
     */
    async callApplyAsync(ecc, applyName, ...args) {
        let frame = ecc.push({ object: this.masterObject, method: 'callApplyAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (typeof applyName === 'function') {
                applyName = applyName.name;
            }
            if (typeof this[applyName] === 'function')
                applyName = this[applyName].name;
            if (applyName.startsWith('bound '))
                applyName = applyName.slice(6);
            if (typeof this.masterObject[applyName] !== 'function')
                throw new Error(`Master object ${this.masterFilename} does not contain apply '${applyName}'`);
            if (this.efuns.isAsync(this.masterObject[applyName]))
                return await this.masterObject[applyName](frame.branch(), ...args);
            else
                return this.masterObject[applyName](frame.branch(), ...args);
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Call an apply in the master object and return the result
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} applyName The name of the apply to call
     * @param {...any} args
     */
    callApplySync(ecc, applyName, ...args) {
        let frame = ecc.push({ object: this.masterObject, method: 'callApplySync', isAsync: false, callType: CallOrigin.Driver });
        try {
            if (typeof applyName === 'function') {
                applyName = applyName.name;
            }
            if (applyName.startsWith('bound '))
                applyName = applyName.slice(6);
            if (typeof this.masterObject[applyName] !== 'function')
                throw new Error(`Master object ${this.masterFilename} does not contain apply '${applyName}'`);
            if (this.efuns.isAsync(this.masterObject[applyName]))
                throw new Error(`Cannot call async method ${applyName} in synchronous context`);
            else
                return this.masterObject[applyName](frame.branch(), ...args);
        }
        finally {
            frame.pop(true);
        }
    }

    async createSecurityManager() {
        return await this.driverCallAsync('createSecurityManager', async () => {
            return this.securityManager = this.fileManager.securityManager;
        }, undefined, true);
    }

    /**
     * Removes absolute paths from a stack trace if possible.
     * @param {Error} e The error to sanitize.
     * @param {boolean} sdf Show external frames
     * @returns {Error} The cleaned up error.
     */
    cleanError(e, sdf = true) {
        if (e.clean || !e.stack)
            return e;
        sdf = true;
        let s = e.stack,
            l = s.split('\n').filter(s => s.length),
            mp = this.fileManager.mudlibAbsolute,
            dp = this.config.driver.driverPath,
            showDriverFrames = sdf || this.config.driver.showDriverFrames,
            mudFile = false,
            newStack = [];

        while (l[0] && !l[0].match(/^\s+at /)) {
            newStack.push(l.shift());
        }

        l.forEach(t => {
            let s1 = t.indexOf('(') + 1, s2 = t.lastIndexOf(')'),
                info = t.slice(s1, s2),
                parts = info.split(':'),
                file = (parts.length > 3 ? parts.splice(0, parts.length - 2).join(':') : parts.shift()).trim(),
                line = parts.shift(),
                col = parts.shift(),
                mudPath = file && driver.fileManager.toMudPath(file.startsWith('at ') ? file.slice(3) : file);

            if (mudPath) {
                newStack.push(t.slice(0, s1) + `${mudPath}:${line}:${col}` + t.slice(s2));
                if (!mudFile)
                    mudFile = mudPath;
            }
            else if (showDriverFrames === true) {
                if (file.startsWith(dp)) {
                    file = file.replace(dp, '[driver]');
                    newStack.push(t.slice(0, s1) + `${file}:${line}:${col}` + t.slice(s2));
                }
            }
        });
        e.file = mudFile;
        e.stack = newStack.join('\n');
        e.clean = true;
        return e;
    }

    /**
     * Clears the execution context
     * @param {ExecutionContext} ecc The context that is finishing.
     */
    clearContext(ecc) {
        this.executionContext = ecc.previous || false;
    }

    /**
     * Compile a virtual object
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} filename The virtual file to compile
     * @param {any[]} args Arguments to pass to the virtual constructor
     * @returns {Promise<MUDObject>}
     */
    async compileVirtualObject(ecc, filename, args = []) {
        let frame = ecc.push({ object: this.masterObject, method: 'compileVirtualObject', callType: CallOrigin.Driver });
        try {
            if (!this.masterObject)
                throw new Error('FATAL: No master object has been loaded!');
            else if (!this.applyCompileVirtual)
                //  Virtual compiling is not enabled
                return false;
            else
                return await this.applyCompileVirtual(frame.branch(), filename, args);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Connect an incoming player to the game.
     * @param {ExecutionContext} ecc The current callstack
     * @param {number} port
     * @param {'http' | 'telnet' | 'https' | 'ssl'} type The type of client connection
     */
    async connect(ecc, port, type, credentials = false) {
        let frame = ecc.push({ file: __filename, object: this.masterObject, method: 'connect', callType: CallOrigin.Driver, isAsync: true });
        try {
            return await this.applyConnect(ecc.branch(), port, type);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Crash the game server and process
     * @param {Error} err The error that is responsible for the crash
     * @param {number} exitCode The exit code to exit with
     */
    crash(err, exitCode = -2) {
        const message = `${driver.efuns.mudName} has crashed due to an internal error`;
        this.playerObjects.forEach(store => {
            store.owner?.receiveMessage(message)
        });
        console.log(`KMUD has crashed due to an internal error: ${(err + (err.stack ? '\n' + err.stack : ''))}`);
        process.exit(exitCode);
    }

    /**
     * Crash the game server and process.
     * @param {Error} err The error that is responsible for the crash
     * @param {number} exitCode The exit code to exit with
     */
    crashAsync(err, exitCode) {
        //  TODO: Only crashAsync() can reliably do logging; Add logging
        this.crash(err, exitCode);
    }

    /** 
     * Create the in-game master object 
     * @param {ExecutionContext} ecc
     */
    async createMasterObjectAsync(ecc) {
        let frame = ecc.push({ object: this, method: 'createMasterObjectAsync', file: __filename, isAsync: true, callType: CallOrigin.Driver });

        try {
            /**
             * Attempts to find an apply method in the master object.
             * @param {string} name THe name of the apply to look for
             * @param {boolean} required Is the apply absolutely required (true) or optional (false)
             * @returns {function(...any)} The master object apply if it exists
             */
            let locateApply = (name, required) => {
                let func = this.masterObject[config.applyNames[name] || name];

                if (typeof func !== 'function' && required === true)
                    throw new Error(`Invalid master object; Could not locate required ${name} apply: ${(config.applyNames[name] || name)}`);
                if (!func)
                    return false;
                return func.bind(this.masterObject);
            };
            let config = this.config.mudlib,
                gameMaster = await this.compiler.compileObjectAsync(ecc.branch(), {
                    file: config.master.path,
                    onInstanceCreated: o => {
                        this.masterObject = o;
                        /* validate in-game master */
                        this.applyCompileVirtual = locateApply('compileVirtualObject', false);
                        this.applyConnect = locateApply('connect', false);
                        this.applyConvertUnits = locateApply('convertUnits', false);
                        this.applyCreateFileACL = locateApply('createFileACL', false);
                        this.applyErrorHandler = locateApply('errorHandler', false);
                        this.applyGetPreloads = locateApply('getPreloads', false);
                        this.applyGetHomePath = locateApply('getHomePath', false);
                        this.applyLogError = locateApply('logError', false);
                        this.applyGetGroups = locateApply('getPermissionGroups', false);
                        this.applyUserExists = locateApply('userExists', true);
                        this.applyRegisterServer = locateApply('registerServer', false);
                        this.applyStartup = locateApply('startup', false);
                        this.applyValidDestruct = locateApply('validDestruct', false);
                        this.applyValidExec = locateApply('validExec', false);
                        this.applyValidObject = locateApply('validObject', false);
                        this.applyValidGroupChange = locateApply('validSecurityGroupChange', true);
                        this.applyValidRead = locateApply('validRead', true);
                        this.applyValidReadConfig = locateApply('validReadConfig', false);
                        this.applyValidRequire = locateApply('validRequire', true);
                        this.applyValidSocket = locateApply('validSocket', false);
                        this.applyValidShutdown = locateApply('validShutdown', true);
                        this.applyValidWrite = locateApply('validWrite', true);
                    }
                });

            if (!gameMaster) {
                throw new Error('In-game master could not be loaded; Abort!');
            }

            /** @type {MasterObject} */
            this.masterObject = gameMaster.defaultExport;

            if (!this.masterObject) {
                throw new Error(`Failed to load master object (${config.master.path})`);
            }

            this.rootUid = typeof this.masterObject.get_root_uid === 'function' ?
                this.masterObject.get_root_uid() || 'ROOT' : 'ROOT';

            this.backboneUid = typeof this.masterObject.get_backbone_uid === 'function' ?
                this.masterObject.get_backbone_uid() || 'BACKBONE' : 'BACKBONE';

            return this;
        }
        catch (err) {
            console.log(`CRITICAL: GameServer.createMasterObject() failed with error: ${err.message}`);
            throw err;
        }
        finally {
            frame.pop();
        }
    }

    /** 
     * Initializes the filesystem. 
     * @param {ExecutionContext} ecc
     */
    async createFileSystems(ecc) {
        let frame = ecc.push({ file: __filename, lineNumber: __line, method: 'createFileSystems', isAsync: true, callType: CallOrigin.Driver });

        try {
            let fsconfig = this.config.mudlib.fileSystem;

            logger.logIf(LOGGER_PRODUCTION, 'Creating filesystem(s)');
            this.fileManager = await fsconfig.createFileManager(this);
            await this.fileManager.bootstrap(frame.context, fsconfig); // fsconfig.eachFileSystem(async (config, index) => await this.fileManager.createFileSystem(config, index));
            this.securityManager = this.fileManager.securityManager;
            await this.securityManager.bootstrap(frame.branch(), this);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Start a new execution context/stack
     * @param {Partial<ExecutionFrame>} initialFrame
     */
    createNewContext(initialFrame = false) {
        let ecc = new ExecutionContext();
        if (initialFrame)
            ecc.push(initialFrame);
        return (this.executionContext = ecc);
    }

    /**  
     * Preload some common objects 
     * @param {ExecutionContext} ecc
     */
    async createPreloads(ecc) {
        let frame = ecc.push({ method: 'createPreloads', isAsync: true });
        try {
            ecc.alarmTime = Number.MAX_SAFE_INTEGER;

            if (this.applyGetPreloads !== false) {
                this.preloads = await this.applyGetPreloads(frame.branch());
            }
            if (this.preloads.length > 0) {
                logger.logIf(LOGGER_PRODUCTION, 'Creating preloads.');

                for (let i = 0; i < this.preloads.length; i++) {
                    let filename = this.preloads[i];
                    try {
                        let file = await this.fileManager.getObjectAsync(frame.branch(), filename);
                        await file.loadObjectAsync(frame.branch());
                    }
                    catch (e) {
                        logger.log(`\tPreload: ${filename}: [FAILURE: ${ex}]`);
                    }
                }
            }
        }
        catch (ex) {
            console.log(`Failed to load all preloads: ${ex}`);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Create an efuns instance for the specified module.
     * @param {string} fileName The filename to create an efuns object for.
     * @returns {EFUNProxy} The file-specific efun proxy object.
     */
    createEfunInstance(fileName) {
        let module = this.cache.get(fileName) || false;

        if (!module) {
            console.log(`Could not find module ${fileName}`);
            return false;
        }

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
     * @param {ExecutionContext} ecc
     * @returns {EFUNProxy} The sealed simul efun object.
     */
    async createSimulEfuns(ecc) {
        let frame = ecc.push({ object: this, method: 'createSimulEfuns', isAsync: true, callType: CallOrigin.Driver });
        try {
            let EFUNProxy = require('./EFUNProxy');
            if (this.simulEfunPath) {
                let module = await this.compiler.compileObjectAsync(ecc.branch(), {
                    file: this.simulEfunPath,
                    flags: CompilerFlags.CompileOnly,
                    altParent: require('./EFUNProxy'),
                    noSeal: true
                });
                this.simulEfunType = module.getType();
            }
            else {
                this.simulEfunType = EFUNProxy;
            }
        }
        catch (err) {
            //  Fatal
            throw err;
        }
        finally {
            frame.pop();
            Object.seal(this.simulEfunType);
            this.initDriverEfuns(new this.simulEfunType('/', '/'));
            this.efuns.SaveExtension = this.config.mudlib.defaultSaveExtension;
            Object.freeze(this.efuns);
        }
        return this.efuns;
    }

    /** 
     * Configure the various components attached to the driver. 
     * @param {ExecutionContext} ecc
     */
    configureRuntime(ecc) {
        let frame = ecc.push({ file: __filename, method: 'configureRuntime' });
        try {
            let
                ClientInstance = require('./network/ClientInstance'),
                MUDCache = require('./MUDCache'),
                MUDCompiler = require('./MUDCompiler'),
                EFUNProxy = require('./EFUNProxy'),
                MUDModule = require('./MUDModule'),
                MUDStorage = require('./MUDStorage'),
                MUDLoader = require('./MUDLoader');

            EFUNProxy.configureForRuntime();
            MUDCompiler.configureForRuntime(this);
            MUDLoader.configureForRuntime(this);
            MUDModule.configureForRuntime(this);
            ClientInstance.configureForRuntime(this);
            MUDStorage.configureForRuntime(this);

            global.MUDObject = MUDObject;

            this.cache = new MUDCache();
            this.compiler = new MUDCompiler(this, this.config.driver.compiler);

            global.unwrap = function (...args) {
                let [frame, target, success, hasDefault] = ExecutionContext.tryPushFrame(arguments, { method: 'unwrap' });
                try {
                    let result = false,
                        defaultValue = hasDefault || false,
                        onSuccess = typeof success === 'function' && success || (s => s);

                    if (typeof target === 'function' && target.isWrapper === true) {
                        result = target();
                        if (!result || typeof result !== 'object' || result.constructor.name === 'Object')
                            result = defaultValue;
                    }
                    else if (target instanceof MUDObject) { // if (typeof target === 'object' && result.constructor.name !== 'Object') {
                        result = target;
                    }
                    else if (target instanceof SimpleObject) {
                        result = target;
                    }
                    else if (typeof target === 'function') {
                    }
                    else if (typeof target === 'string') {
                        let parts = driver.efuns.parsePath(target),
                            module = driver.cache.get(parts.file);

                        if (parts.defaultType && module) {
                            result = module.defaultExport instanceof MUDObject ? module.defaultExport : false;
                        }
                    }
                    else if (Array.isArray(target)) {
                        let items = target.map(t => global.unwrap(t))
                            .filter(o => o instanceof MUDObject);

                        if (items.length !== target.length)
                            return onSuccess ? onSuccess() : undefined;

                        if (onSuccess)
                            return onSuccess(items);

                        return items;
                    }
                    else if (typeof defaultValue === 'function')
                        return defaultValue();

                    return result && onSuccess(result);
                }
                finally {
                    frame?.pop();
                }
            };

            /**
             * 
             * @param {ExecutionContext} ecc
             * @param {any} target
             * @param {any} success
             * @param {any} hasDefault
             * @returns
             */
            global.unwrapAsync = async function (ecc, target, success, hasDefault) {
                let frame = ecc.push({ method: 'unwrapAsync', isAsync: true });

                try {
                    if (typeof target === 'string') {
                        let parts = driver.efuns.parsePath(target),
                            module = driver.cache.get(parts.file);

                        if (!module) {
                            let result = await driver.efuns.loadObjectAsync(frame.branch(), target);
                            if (result)
                                return global.unwrap(result, success, hasDefault);
                        }
                    }
                    return global.unwrap(frame.context, target, success, hasDefault);
                }
                finally {
                    frame.pop();
                }
            };

            global.wrapper = function (o) {
                if (typeof o === 'function' && o.isWrapper === true) return o;
                else if (o instanceof MUDObject) {
                    let parts = driver.efuns.parsePath(o.trueName || o.filename),
                        module = driver.cache.get(parts.file);
                    return module.getInstanceWrapper(parts);
                }
                else if (o instanceof SimpleObject)
                    throw new Error('SimpleObject types cannot be wrapped');
                return false;
            };

            require('./MUDCache').configureForRuntime(this);
        }
        catch (err) {
            console.log(err.message);
            console.log(err.stack);
            throw err;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Convert a value to a standardized unit of measurement
     * @param {number} units The number of units
     * @param {string} unitType The unit type (pounds, kgs, kelvin, etc)
     * @returns {number} The value in "standard" units
     */
    convertUnits(units, unitType) {
        if (typeof units !== 'number') units = parseFloat(units);
        if (isNaN(units)) return false;
        if (!this.masterObject || !this.applyConvertUnits || typeof unitType !== 'string') units;
        return this.applyConvertUnits(units, unitType);
    }

    /**
     * Create a context frame that includes the master/driver.
     * @param {string} method The method being called.
     * @param {function(ExecutionContext):any} callback The callback that executes when the context is ready.
     * @param {string} file The optional filename
     * @returns {any} The result of the callback
     */
    driverCall(method, callback, file, rethrow = false) {
        const
            ecc = ExecutionContext.getCurrentExecution(true),
            frame = ecc.push({ object: this.masterObject, method, file, callType: CallOrigin.Driver });
        let result;

        try {
            result = callback(ecc);
        }
        catch (err) {
            logger.log(`Error in method '${method}': ${err.message}\r\n${err.stack}`);
            if (rethrow) throw err;
            else result = err;
        }
        finally {
            frame.pop(true);
        }
        return result;
    }

    /**
     * Create a context frame that includes the master/driver.
     * @param {string} method The method being called.
     * @param {function(ExecutionContext):any} callback The callback that executes when the context is ready.
     * @param {string} fileName The optional filename
     * @returns {any} The result of the callback
     */
    async driverCallAsync(method, callback, fileName, rethrow = false) {
        const
            ecc = ExecutionContext.getCurrentExecution(true),
            frame = ecc.push({ object: this.masterObject, method: 'driverCallAsync', file: fileName || __filename, callType: CallOrigin.Driver });
        let result;

        try {
            result = await callback(ecc);
        }
        catch (err) {
            logger.log(`Error in method '${method}': ${err.message}\r\n${err.stack}`);
            if (rethrow) throw err;
            else result = err;
        }
        finally {
            frame.pop(true);
        }
        return result;
    }

    /**
     * Expand the functionality of the driver by loading additional functionality.
     */
    async enableFeaturesAsync() {
        const
            EFUNProxy = require('./EFUNProxy');

        logger.logIf(LOGGER_DEBUG, 'Bootstrap: Initializing driver features');
        this.features = this.config.driver.forEachFeature((featureConfig, pos, id) => {
            if (featureConfig.enabled) {
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
     * @param {ExecutionContext} ecc The current callstack
     * @param {Error} err The exception that must be handled.
     * @param {boolean} caught Indicates whether the exception was caught elsewhere.
     */
    errorHandler(ecc, err, caught) {
        const frame = ecc.push({ object: this.gameMaster, method: 'errorHandler', callType: CallOrigin.Driver });
        try {
            if (this.applyErrorHandler) {
                if (err instanceof Error)
                    this.cleanError(err);
                let error = {
                    error: typeof err === 'string' ? err : err.message,
                    program: '',
                    object: null,
                    line: 0,
                    stack: err.stack,
                    trace: []
                }, firstFrame = true;

                this.applyErrorHandler(frame.context, error, caught);
            }
        }
        finally {
            frame.pop();
        }
    }

    /** Periodically call heartbeat on all applicable objects in the game. */
    async executeHeartbeat() {
        try {
            let heartbeatStart = new Date(),
                maxExecTime = this.config.driver.maxCommandExecutionTime,
                heartbeatInterval = maxExecTime || 2000,
                beatingHearts = this.heartbeatObjects.toArray(),
                failed = [];

            await async.forEachOfLimit(beatingHearts, this.heartbeatLimit || 10,
                async (store, index, itr) => {
                    return ExecutionContext.withNewContext({ object: this.masterObject, method: 'executeHeartbeat', isAsync: true, callType: CallOrigin.Driver }, async ecc => {
                        try {
                            ecc.alarmTime = this.debugMode ? Number.MAX_SAFE_INTEGER : Date.now() + heartbeatInterval;
                            ecc.setThisPlayer(store.owner, true);

                            await store.eventHeartbeat(ecc, this.heartbeatInterval, this.heartbeatCounter);
                        }
                        catch (err) {
                            failed.push(store);
                        }
                        finally {
                            typeof itr === 'function' && itr();
                        }
                    });
                },
                () => {
                    let timing = efuns.ticks - heartbeatStart.getTime();
                    if (timing > heartbeatInterval) {
                        logger.log(`\tWARNING: Last heartbeat cycle took ${timing}ms > ${heartbeatInterval}`);
                    }
                    this.heartbeatCounter++;
                    this.heartbeatTimer = setTimeout(async () => {
                        await this.executeHeartbeat();
                    }, this.heartbeatInterval);
                });
        }
        catch (err) {
            //  TODO: This should be a game-crasher
            logger.log('FATAL: Error in executeHeartbeat: ' + err);
            this.errorHandler(err, false);
        }
    }

    /** Get the server address */
    getAddress() {
        return this.serverAddress;
    }

    /**
     * Fetch the current execution context.
     * 
     * @param {any} ob The current object
     * @param {any} method The current method
     * @param {any} fileName The current filename
     * @param {boolean} isAsync Was the call async?
     * @param {number} lineNumber The line number the call originated on.
     * @param {string} callString The expression giving a rough depiction of the call hierarchy.
     * @returns {ExecutionContext} The context.
     */
    getExecution(ob, method, fileName, isAsync, lineNumber, callString) {
        if (arguments.length === 0)
            return this.executionContext || false;
        if (!this.executionContext) {
            this.executionContext = new ExecutionContext();
        }
        return this.executionContext.push(ob, method, fileName, isAsync, lineNumber, callString || method);
    }

    /**
     * Get all outstanding/unfinished execution contexts
     * @returns {Object.<string,ExecutionContext>}
     */
    getExecutionContexts() {
        return ExecutionContext.getContexts();
    }

    async getGroups(target) {
        if (!this.masterObject)
            return ['$BACKBONE', '$ADMIN']; // Replace with config later
        else return await this.applyGetGroups(target);
    }

    inGroup(target, ...groups) {
        if (this.gameState < GAMESTATE_RUNNING) return true;
        else return driver.masterObject.inGroup(target, [].slice.call(arguments, 1));
    }

    /**
     * Set the driver's version of the efuns object.
     * @param {import('./EFUNProxy')} efuns
     */
    initDriverEfuns(efunsIn) {
        /**
         * @global
         * @type {import('./EFUNProxy')}
         */
        const efuns = efunsIn;
        this.efuns = global.efuns = efuns;
    }

    /**
     * 
     * @param {Object} proto
     * @param {string[]} specificMethodList
     * @returns
     */
    instrumentObject(proto, specificMethodList = false) {
        if (!proto.__native) {
            proto.__native = {};
            let props = Object.getOwnPropertyDescriptors(proto);

            for (const [name, prop] of Object.entries(props)) {
                if (typeof proto[name] === 'function') {
                    if (specificMethodList && specificMethodList.indexOf(name) === -1)
                        continue;
                    (function (name, impl) {
                        /**
                         * 
                         * @param {ExecutionContext} ctx
                         * @param {...any} parms
                         * @returns
                         */
                        proto[name] = function (...parms) {
                            if (parms[0] instanceof ExecutionContext) {
                                let [ctx, ...args] = parms,
                                    frame = ctx.push({ method: name });
                                try {
                                    let result = proto.__native[name].apply(this, args);
                                    return result;
                                }
                                finally {
                                    frame.pop();
                                }
                            }
                            else {
                                let result = proto.__native[name].apply(this, parms);
                                return result;
                            }
                        };
                    })(name, proto.__native[name] = proto[name]);
                }
            }
            Object.seal(proto);
        }
        return proto;
    }

    /**
     * Allow the in-game master object to handle an error.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} path The file to write logs to.
     * @param {Error} error The error to log.
     */
    async logError(ecc, path, error) {
        let frame = ecc.push({ object: this.masterObject, method: 'logError', isAsync: true, callType: CallOrigin.Driver, unguarded: true });
        try {
            if (!this.applyLogError) {
                logger.log('Compiler Error: ' + error.message);
                logger.log(error.stack);
            }
            else {
                await this.applyLogError(frame.branch(1118), path, error);
            }
        }
        finally {
            frame.pop();
        }
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

    /**
     * Perform optional pre-compiler steps
     * @param {ExecutionContext} ecc
     * @param {MUDModule} module The module being processed
     * @returns {boolean}
     */
    preCompile(ecc, module) {
        let frame = ecc.push({ method: 'preCompile', callType: CallOrigin.Driver });
        try {
            if (this.preCompilers.any(pre => pre.preCompile(frame.context, module)))
                return false;
            return true;
        }
        finally {
            frame.pop();
        }
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
                resetTime = efuns.ticks + ResetInterval / 2 + Math.random(ResetInterval / 2);
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
     * Register an external server.
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} spec
     */
    registerServer(ecc, spec) {
        let frame = ecc.push({ method: 'registerServer', callType: CallOrigin.Driver });
        try {
            if (this.applyRegisterServer)
                return this.applyRegisterServer(frame.branch(), spec);
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Restores context after an async call has completed.
     * @param {ExecutionContext | false} ecc The context to restore
     */
    restoreContext(ecc = false) {
        let prev = this.executionContext;

        if (true === ecc instanceof ExecutionContext)
            this.executionContext = ecc;
        else if (ecc === false)
            this.executionContext = false;
        else
            throw 'Illegal call to restoreContext()';
        return prev;
    }

    /**
     * Runs the MUD
     * @param {function(MUDConfig):void} callback Callback to execute when the MUD is running.
     * @returns {GameServer} A reference to the GameServer.
     */
    async run(callback) {
        if (this.config.singleUser !== true) {
            let nets = await NetUtil.discoveryAsync()
                .catch(err => { throw new Error(`Could not start GameServer: ${err}`); }),
                list = nets.filter(n => n.internetAccess);

            if (list.length === 0)
                throw new Error('Could not start GameServer: No suitable network interfaces');

            this.serverAddress = list[0].address;
        }
        else {
            this.serverAddress = '127.0.0.1';
        }

        logger.log('Starting %s', this.mudName);
        let ecc = this.createNewContext(),
            frame = ecc.push({ object: this, file: __filename, method: 'run', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (this.globalErrorHandler) {
                process.on('uncaughtException', err => {
                    logger.log('uncaughtException', err);
                    logger.log(err.stack);
                    this.errorHandler(err, false);
                });
                process.on('unhandledRejection', (reason, promise) => {
                    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
                    // Application specific logging, throwing an error, or other logic here
                });
            }
            await this.createFileSystems(ecc.branch({ lineNumber: 1293, hint: 'this.createFileSystems' }));
            this.configureRuntime(ecc);

            console.log('Loading driver and external features');
            try {
                await this.createSimulEfuns(ecc.branch({ lineNumber: 1298, hint: 'this.createSimulEfuns' }));
                await this.createMasterObjectAsync(ecc);
                await this.securityManager.validateAsync(ecc, this);
                await this.securityManager.initSecurityAsync(ecc);
                await this.enableFeaturesAsync();
                this.sealProtectedTypes();
            }
            catch (ex) {
                console.log(`FATAL ERROR DURING STARTUP:`, ex);
                process.exit(-111);
            }
            await this.runStarting(ecc.branch());

            if (this.masterObject && this.applyStartup)
                await this.applyStartup(frame.branch({ lineNumber: 1312, hint: 'this.applyStartup' }));
            if (callback)
                callback.call(this);
        }
        finally {
            frame.pop();
        }
        return await this.runMain();
    }

    /**
     * Run second stage of startup
     * @param {ExecutionContext} ecc
     */
    async runStarting(ecc) {
        const frame = ecc.push({ file: __filename, method: 'runStarting', lineNumber: __line, isAsync: true, className: this, callType: CallOrigin.Driver });
        try {
            this.gameState = GAMESTATE_STARTING;
            await this.createPreloads(ecc.branch());
            if (this.config.skipStartupScripts === false) {
                let runOnce = path.resolve(__dirname, '../runOnce.json');
                if (fs.existsSync(runOnce)) {
                    let list = this.config.stripBOM(fs.readFileSync(runOnce, 'utf8'))
                        .split(efuns.eol)
                        .map(s => JSON.parse(s));
                    try {
                        let $storage = this.storage.get(this.masterObject);
                        $storage.emit('kmud', { type: 'runOnce', dataData: list });
                        logger.log(`Run once complete; Removing ${runOnce}`);
                        fs.unlinkSync(runOnce);
                    }
                    catch (err) {
                        logger.log(`Error running runOnce.json: ${err.message}`);
                    }
                }
            }
            for (let i = 0; i < this.endpoints.length; i++) {
                let beFrame = ecc.push({ object: this.masterObject, method: 'bindEndpoints', callType: CallOrigin.Driver });
                try {
                    this.endpoints[i]
                        .bind(beFrame.branch())
                        .on('kmud.connection', /** @param {MUDClient} client */ client => {
                            this.driverCall('onConnection', () => {
                                //let newLogin = this.masterObject.connect(client.port, client.clientType);
                                //if (newLogin) {
                                //    client.setBody(newLogin);

                                //    if (driver.connections.indexOf(client) === -1)
                                //        driver.connections.push(client);
                                //}
                                //else {
                                //    client.writeLine('Sorry, something is very wrong right now; Please try again later.');
                                //    client.close('No Login Object Available');
                                //}
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
                finally {
                    beFrame.pop();
                }
            }
            if (typeof callback === 'function') callback.call(this);

            let startupTime = Date.now() - this.startTime,
                startSeconds = startupTime / 1000;

            logger.log(`Startup took ${startSeconds} seconds [${startupTime} ms]`);
        }
        finally {
            frame.pop();
        }
    }

    async runMain() {
        let ecc = ExecutionContext.startNewContext(),
            frame = ecc.push({ object: this.masterObject, file: __filename, method: 'runMain', callType: CallOrigin.Driver, isAsync: true });

        try {
            this.gameState = GAMESTATE_RUNNING;
            try {
                await this.masterObject.emit('ready', this.masterObject);
            }
            catch (err) {
                /* do nothing if ready event borks */
            }
            finally {
            }
            if (this.config.mudlib.heartbeatInterval > 0) {
                this.heartbeatTimer = setTimeout(async () => {
                    await this.executeHeartbeat();
                }, this.config.mudlib.heartbeatInterval);
            }

            if (this.config.mudlib.objectResetInterval > 0 && this.config.driver.useLazyResets === false) {
                this.resetTimer = setInterval(async () => {
                    let n = 0;

                    for (let i = 0, now = efuns.ticks; i < this.resetStack.length; i++) {
                        let timestamp = this.resetStack[i],
                            list = this.resetTimes[timestamp];

                        if (timestamp > 0 && timestamp < now) {
                            for (const [item, index] of Object.entries(list)) {
                                let ob = item.instance;
                                try {
                                    let $storage = driver.storage.get(ob);
                                    if ($storage.nextReset < now) {
                                        await ob.reset();
                                        this.registerReset(item, false);
                                    }
                                }
                                catch (resetError) {
                                    // Do not re-register reset--now disabled for previous object.
                                    this.errorHandler(resetError, false);
                                }
                            };
                            delete this.resetTimes[timestamp];
                            n++;
                            continue;
                        }
                        break;
                    }
                    //  This requires revisiting.  Use real stack and pop to avoid grossness like this.
                    if (n > 0) this.resetStack.splice(0, n);
                }, this.config.driver.resetPollingInterval);
            }
            return this;
        }
        finally {
            frame.pop();
        }
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

    validExec(frame, oldBody, newBody) {
        if (this.gameState < GAMESTATE_RUNNING)
            return false;
        else if (this.applyValidExec === false) return true;
        else return this.applyValidExec(frame.context, oldBody, newBody);
    }

    validObject(arg) {
        let result = unwrap(arg, ob => {
            if (this.gameState < GAMESTATE_INITIALIZING) return true;
            else if (this.applyValidObject === false) return true;
            else return this.applyValidObject(ob);
        });
        return result === true;
    }

    /**
     * Get the MUD uptime.
     * @returns {number} The game uptime in milliseconds.
     */
    uptime() {
        return efuns.ticks - this.startTime;
    }

    /**
     * Check to see if a destruct call should be allowed to succeed.
     * @param {MUDObject} target The object that is being destructed.
     * @param {ExecutionFrame} frame The frame that is being evaluated.
     * @returns {boolean} True if the destruct is allowed, false if it should be blocked.
     */
    validDestruct(frame, target) {
        if (!this.applyValidDestruct)
            return target !== driver.masterObject;
        else if (frame.object === target)
            return true;
        return this.applyValidDestruct(frame.context, frame.object || frame.file, target, frame.method);
    }

    /**
     * Checks to see if the current permissions stack can read the config.
     * @param {string} key The key to try and read from
     * @returns {boolean} Returns true if the read operation should be permitted.
     */
    validReadConfig(key) {
        if (this.gameState < GAMESTATE_RUNNING)
            return true;
        else if (!this.applyValidReadConfig)
            return false; //  By default, config is not visible in game
        else ExecutionContext.getCurrentExecution()
            .guarded(f => this.applyValidReadConfig(frame.context, f.object || f.file, key, f.method));
    }

    /**
     *
     * @param {ExecutionFrame} frame Contains a single frame to validate
     * @param {string} path The file that is to be read.
     * @returns {boolean} True if the read operation can proceed.
     */
    async validRead(frame, path) {
        //  No master object yet; We have no way of validating reads.
        if (!this.masterObject)
            return true;
        else if (frame.object === driver.masterObject || frame.object === driver)
            return true;
        else
            return await this.applyValidRead(frame.branch(), path, frame.object || frame.file, frame.method);
    }

    validRequire(efuns, moduleName) {
        return true;
    }

    /**
     * Checks to see if a shutdown request is valid.
     * @param {ExecutionFrame} frame The current execution frame to evaluate
     * @returns {boolean} Returns true if the shutdown may proceed.
     */
    validShutdown(frame) {
        if (this.gameState !== GAMESTATE_RUNNING)
            return true;
        else if (!this.applyValidShutdown)
            return true;
        else {
            return this.driverCall('validShutdown', () => this.masterObject.validShutdown(frame.context, frame));
        }
    }

    /**
     * Check to see if a write operation should be permitted.
     * @param {ExecutionFrame} frame Contains a single frame to validate
     * @param {string} writePath The file that is to be written to.
     */
    async validWrite(frame, writePath) {
        if (this.gameState < GAMESTATE_INITIALIZING)
            return true;
        else if (frame.object === this || frame.object === this.masterObject)
            return true;
        else
            return this.applyValidWrite(frame.branch(), writePath, frame.object || frame.file, frame.method);
    }
}

module.exports = GameServer;
