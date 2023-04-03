/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    ExecutionContext = require('./ExecutionContext'),
    { NetUtil } = require('./network/NetUtil'),
    { LinkedList, LinkedListWithID, LinkedListWithLookup } = require('./LinkedList'),
    MUDObject = require('./MUDObject'),
    semver = require('semver'),
    async = require('async');


const
    fs = require('fs'),
    path = require('path'),
    os = require('os'),
    uuidv5 = require('uuid/v5'),
    MUDEventEmitter = require('./MUDEventEmitter');

class GameServer extends MUDEventEmitter {
    /**
     * Construct a new game server
     * @param {MUDConfig} config The configuration object.
     */
    constructor(config) {
        super();

        global.driver = this;

        let extensionsDir = path.join(__dirname, 'extensions');
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

        let test = new ArrayWithMax(2);
        test.push(1, 2, 3, 4, 5);

        var foo = test.slice();

        this.efunProxyPath = path.resolve(__dirname, './EFUNProxy.js');

        /** @type {EFUNProxy} */
        let efunType = require('./EFUNProxy');
        this.initDriverEfuns(new efunType('/'));
        this.startTime = efuns.ticks;

        /** @type {MUDConfig} */
        this.config = config;
        this.executionContext = false;

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
        this.wizardObjects = new LinkedList();

        //  Locations where $include and require look for unqualified files
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
     * Called to get the current working directory of the specified object (or the current player)
     * @param {MUDObject} player
     * @param {string} defaultDir The default directory if no directory is returned by current player
     * @returns {string} The working directory.
     */
    applyGetWorkingDir(player = false, defaultDir = '/') {
        if (!(player = player || this.efuns.thisPlayer()))
            throw new Error('No player!');

        return this.driverCall('applyGetWorkingDir', ecc => {
            let store = this.storage.get(player);
            return ecc.withPlayer(store, player => {
                if (typeof player.applyGetWorkingDir === 'function')
                    return player.applyGetWorkingDir();
                return defaultDir;
            });
        });
    }

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

    async callApplyAsync(applyName, ...args) {
        return await this.driverCallAsync(applyName, async ecc => {
            if (typeof this.masterObject[applyName] !== 'function')
                throw new Error(`Master object ${this.masterFilename} does not contain apply '${applyName}'`);
            return await this.masterObject[applyName](...args);
        }, undefined, true);
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
    cleanError(e, sdf) {
        if (e.clean || !e.stack)
            return e;
        let s = e.stack,
            l = s.split('\n').filter(s => s.length),
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

    /**
     * Clears the execution context
     * @param {ExecutionContext} ecc The context that is finishing.
     */
    clearContext(ecc) {
        this.executionContext = ecc.previous || false;
    }

    /**
     * Compile a virtual object
     * @param {string} filename The virtual file to compile
     * @param {any[]} args Arguments to pass to the virtual constructor
     * @returns {Promise<MUDObject>}
     */
    async compileVirtualObject(filename, args = []) {
        if (!this.masterObject)
            throw new Error('FATAL: No master object has been loaded!');
        else if (!this.applyCompileVirtual)
            //  Virtual compiling is not enabled
            return false;
        else
            return await this.applyCompileVirtual(filename, args);
    }

    /**
     * 
     * @param {any} port
     * @param {any} type
     */
    async connect(port, type) {
        return await this.driverCallAsync('connect', async () => {
            return await this.applyConnect(port, type);
        });
    }

    /** Create the in-game master object */
    async createMasterObject() {
        return await this.driverCallAsync('createMasterObject', async () => {
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
                    masterFile = await this.fileManager.getObjectAsync(config.master.path, 0, true),
                    gameMaster = await this.compiler.compileObjectAsync({
                        file: config.master.path,
                        onPipelineComplete: src => {
                            // console.log('driver source', src);
                        },
                        onInstanceCreated: o => {
                            if (config.master.path.startsWith(o.filename)) {
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
                                this.applyRegisterServer = locateApply('registerServer', false);
                                this.applyStartup = locateApply('startup', false);
                                this.applyValidDestruct = locateApply('validDestruct', false);
                                this.applyValidExec = locateApply('validExec', false);
                                this.applyValidObject = locateApply('validObject', false);
                                this.applyValidRead = locateApply('validRead', true);
                                this.applyValidReadConfig = locateApply('validReadConfig', false);
                                this.applyValidRequire = locateApply('validRequire', true);
                                this.applyValidSocket = locateApply('validSocket', false);
                                this.applyValidShutdown = locateApply('validShutdown', true);
                                this.applyValidWrite = locateApply('validWrite', true);
                            }
                        }
                    });

                if (!gameMaster) {
                    throw new Error('In-game master could not be loaded; Abort!');
                }

                /** @type {MasterObject} */
                this.masterObject = gameMaster.getInstance(0);

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
        }, 'master', true);
    }

    /**
     * Attempt to load/create a directory-based ACL
     * @param {string} directory
     */
    async createFileACL(directory) {
        if (this.applyCreateFileACL === false)
            return null;

        return await this.driverCallAsync('applyCreateFileACL', async () => {
            return await this.applyCreateFileACL(directory, frame.object || frame.file, frame.method);
        });
    }

    /** Initializes the filesystem. */
    async createFileSystems() {
        let fsconfig = this.config.mudlib.fileSystem;

        logger.logIf(LOGGER_PRODUCTION, 'Creating filesystem(s)');
        this.fileManager = await fsconfig.createFileManager(this);
        await this.fileManager.bootstrap(fsconfig); // fsconfig.eachFileSystem(async (config, index) => await this.fileManager.createFileSystem(config, index));
    }

    /**  Preload some common objects */
    async createPreloads() {
        return await this.driverCallAsync('createPreloads', async ecc => {
            ecc.alarmTime = Number.MAX_SAFE_INTEGER;

            if (this.applyGetPreloads !== false) {
                this.preloads = await this.driverCallAsync('getPreloads', async () => await this.applyGetPreloads());
            }
            if (this.preloads.length > 0) {
                logger.logIf(LOGGER_PRODUCTION, 'Creating preloads.');

                for (let i = 0; i < this.preloads.length; i++) {
                    let filename = this.preloads[i];
                    let t0 = efuns.ticks,
                        err = false;
                    try {
                        let file = await this.fileManager.getObjectAsync(filename);
                        await file.compileAsync()
                            .catch(_ => err = _);
                    }
                    catch (e) {
                        err = e;
                    }
                    finally {
                        let t1 = efuns.ticks;
                        logger.logIf(LOGGER_DEBUG,
                            `\tPreload: ${filename}: ${(!err ? '[OK]' : '[Failure]')} [${(t1 - t0)} ms; ${ecc.stack.length}]`);
                    }
                }
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
    async createSimulEfuns() {

        return await this.driverCallAsync('createSimulEfuns', async () => {
            try {
                let EFUNProxy = require('./EFUNProxy');
                if (this.simulEfunPath) {
                    let module = await this.compiler.compileObjectAsync({
                        file: this.simulEfunPath,
                        noCreate: true,
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
                // Oh snap... fallback plan...
                this.simulEfunType = require('./EFUNProxy');
            }
            finally {
                Object.seal(this.simulEfunType);
                this.initDriverEfuns(new this.simulEfunType('/', '/'));
                this.efuns.SaveExtension = this.config.mudlib.defaultSaveExtension;
                Object.freeze(this.efuns);
            }
            return this.efuns;
        });
    }

    /** Configure the various components attached to the driver. */
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

            EFUNProxy.configureForRuntime();
            MUDCompiler.configureForRuntime(this);
            MUDLoader.configureForRuntime(this);
            MUDModule.configureForRuntime(this);
            ClientInstance.configureForRuntime(this);
            MUDStorage.configureForRuntime(this);

            global.MUDObject = MUDObject;

            this.cache = new MUDCache();
            this.compiler = new MUDCompiler(this, this.config.driver.compiler);

            global.unwrap = function(target, success, hasDefault) {
                let result = false,
                    defaultValue = hasDefault || false,
                    onSuccess = typeof success === 'function' && success || (s => s);

                if (Array.isArray(target)) {
                    let items = target.map(t => global.unwrap(t))
                        .filter(o => o instanceof MUDObject);

                    if (items.length !== target.length)
                        return onSuccess ? onSuccess() : undefined;

                    if (onSuccess)
                        return onSuccess(items);

                    return items;
                }
                else if (typeof target === 'function' && target.isWrapper === true) {
                    result = target();
                    if (!result || typeof result !== 'object' || result.constructor.name === 'Object')
                        result = defaultValue;
                }
                else if (target instanceof MUDObject) { // if (typeof target === 'object' && result.constructor.name !== 'Object') {
                    result = target;
                }
                else if (typeof defaultValue === 'function')
                    return defaultValue();

                return result && onSuccess(result);
            };

            global.wrapper = function (o) {
                if (typeof o === 'function' && o.isWrapper === true) return o;
                else if (o instanceof MUDObject) {
                    let parts = driver.efuns.parsePath(o.filename),
                        module = driver.cache.get(parts.file);
                    return module.getInstanceWrapper(parts);
                }
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
     * @param {string} fileName The optional filename
     * @returns {any} The result of the callback
     */
    driverCall(method, callback, fileName, rethrow = false) {
        let result, ecc = this.getExecution(
            this.masterObject || this,
            method,
            fileName || this.masterFilename,
            false, 0);

        try {
            result = callback(ecc);
        }
        catch (err) {
            logger.log(`Error in method '${method}': ${err.message}\r\n${err.stack}`);
            if (rethrow) throw err;
            else result = err;
        }
        finally {
            ecc.pop(method);
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
    async driverCallAsync(method, callback, fileName, rethrow = false, newContext = false) {
        let result,
            prevContext = false,
            ecc = newContext === true ?
                this.getExecution() :
                this.getExecution(
                    this.masterObject || this,
                    method,
                    fileName || this.masterFilename,
                    false,
                    0);

        if (newContext) {
            prevContext = ecc;
            ecc = this.executionContext = new ExecutionContext();
            ecc.push(this, method || 'driverCallAsync', fileName, true, 0);
        }

        try {
            result = await callback(ecc);
        }
        catch (err) {
            logger.log(`Error in method '${method}': ${err.message}\r\n${err.stack}`);
            if (rethrow) throw err;
            else result = err;
        }
        finally {
            ecc.pop(method);
            this.executionContext = prevContext;
        }
        return result;
    }

    /**
     * Expand the functionality of the driver by loading additional functionality.
     */
    async enableFeatures() {
        const
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

            error.trace = err.stack && err.stack.split('\n').map((line, index) => {
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
            this.applyErrorHandler(error, caught);
        }
    }

    /** Periodically call heartbeat on all applicable objects in the game. */
    executeHeartbeat() {
        try {
            let heartbeatStart = new Date(),
                maxExecTime = this.config.driver.maxCommandExecutionTime,
                heartbeatInterval = maxExecTime || 2000,
                failed = [];

            async.forEachOfLimit(this.heartbeatObjects.toArray(), this.heartbeatLimit || 10,
                (obj, index, itr) => {
                    this.driverCall('heartbeat', ecc => {
                        try {
                            ecc.alarmTime = efuns.ticks + heartbeatInterval;
                            ecc.truePlayer = ecc.player = obj.owner;
                            obj.eventHeartbeat(this.heartbeatInterval, this.heartbeatCounter);
                        }
                        catch (err) {
                            failed.push(obj);
                        }
                        finally {
                            itr();
                        }
                    })
                },
                () => {
                    let timing = efuns.ticks - heartbeatStart.getTime();
                    if (timing > heartbeatInterval) {
                        logger.log(`\tWARNING: Last heartbeat cycle took ${timing}ms > ${heartbeatInterval}`);
                    }
                    this.heartbeatCounter++;
                    this.heartbeatTimer = setTimeout(() => {
                        this.executeHeartbeat();
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

    async getGroups(target) {
        if (!this.masterObject)
            return ['$BACKBONE', '$ADMIN']; // Replace with config later
        else return await this.applyGetGroups(target);
    }

    /**
     * Attempt to read symbols from the specified file
     * @param {string} file The file
     */
    includeFile(file) {
        let files = this.includePath.map(fn => {
            let result = fn + '/' + file;
            if (result.lastIndexOf('.') < result.lastIndexOf('/'))
                result += '.js';
            return result;
        });
        let result = this.driverCall('includeFile', ecc => {
            for (let i = 0; i < files.length; i++) {
                try {
                    if (efuns.isFileSync(files[i])) {
                        let module = driver.compiler.compileObject({ file: files[i] });
                        return module.defaultExport || module.exports;
                    }
                }
                catch (err) {
                    console.log('includeFile:', err);
                }
            }
        });
        return result;
    }

    inGroup(target, ...groups) {
        if (this.gameState < GAMESTATE_RUNNING) return true;
        else return driver.masterObject.inGroup(target, [].slice.call(arguments, 1));
    }

    /**
     * Set the driver's version of the efuns object.
     * @param {any} efuns
     */
    initDriverEfuns(efuns) {
        this.efuns = global.efuns = efuns;
    }

    /**
     * Allow the in-game master object to handle an error.
     * @param {string} path The file to write logs to.
     * @param {Error} error The error to log.
     */
    async logError(path, error) {
        if (!this.applyLogError) {
            logger.log('Compiler Error: ' + error.message);
            logger.log(error.stack);
        }
        else {
            await this.driverCallAsync('logError', async () => {
                await this.applyLogError(path, error);
            })
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
     * Check to see if the node version is at least this version
     * @param {string} versionCheck The minimum version to check for.
     * @returns {boolean} True if the version is at least specified version .
     */
    nodeVersion(versionCheck) {
        if (semver.lt(process.version, versionCheck)) {
            return false;
        }
        return true;
    }

    /**
     * Perform optional pre-compiler steps
     * @param {MUDModule} module The module being processed
     * @returns {boolean}
     */
    preCompile(module) {
        if (this.preCompilers.any(pre => pre.preCompile(module)))
            return false;
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
     * @param {any} spec
     */
    registerServer(spec) {
        //  Failure to register a server is a fatal error
        return this.driverCall('registerServer', () => {
            if (this.applyRegisterServer)
                return this.applyRegisterServer(spec);
            return false;
        }, this.masterFilename, true);
    }

    /**
     * Restores context after an async call has completed.
     * @param {ExecutionContext} ecc The context to restore
     */
    restoreContext(ecc = false) {
        if (this.executionContext && ecc && this.executionContext !== ecc)
            throw new Error(`There is already an execution context that appears to be running!`); // FATAL
        this.executionContext = ecc || false;
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

        logger.log('Starting %s', this.mudName.ucfirst());
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
        await this.createFileSystems();
        this.configureRuntime();

        return await this.driverCallAsync('startup', async () => {
            console.log('Loading driver and external features');
            try {
                let ef = await this.createSimulEfuns();
                let flags = ef.fs.FileSystemQueryFlags;
                let files = await ef.fs.queryFileSystemAsync('/sys/data/**/[km]/*.json', flags.ShowHiddenFiles | flags.ShowSystemFiles);
                await this.createSecurityManager();
                await this.createMasterObject();
                this.securityManager = await this.bootstrapSecurity();
                await this.enableFeatures();
                this.sealProtectedTypes();
            }
            catch (ex) {
                console.log(`FATAL ERROR DURING STARTUP:`, ex);
                process.exit(-111);
            }
            await this.runStarting();

            if (this.masterObject && this.applyStartup)
                await this.applyStartup();
            if (callback)
                callback.call(this);
            return await this.runMain();
        });
    }

    async runStarting() {
        this.gameState = GAMESTATE_STARTING;
        await this.createPreloads();
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
            this.endpoints[i]
                .bind()
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
        if (typeof callback === 'function') callback.call(this);

        let startupTime = efuns.ticks - this.startTime,
            startSeconds = startupTime / 1000;

        logger.log(`Startup took ${startSeconds} seconds [${startupTime} ms]`);
    }

    async runMain() {
        let ecc = this.getExecution(this.masterObject, 'onReady', this.masterObject.filename);
        this.gameState = GAMESTATE_RUNNING;
        try {
            await this.masterObject.emit('ready', this.masterObject);
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
                for (let i = 0, now = efuns.ticks; i < this.resetStack.length; i++) {
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
            }, this.config.driver.resetPollingInterval);
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
        else return this.applyValidExec(frame, oldBody, newBody);
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
    validDestruct(target, frame) {
        if (!this.applyValidDestruct)
            return target !== driver.masterObject;
        else if (frame.object === target)
            return true;
        return this.applyValidDestruct(frame.object || frame.file, target, frame.method);
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
        else this.getExecution()
            .guarded(f => this.applyValidReadConfig(f.object || f.file, key, f.method));
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
            return await this.applyValidRead(path, frame.object || frame.file, frame.method);            
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
            return this.driverCall('validShutdown', () => this.masterObject.validShutdown(frame));
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
            return this.applyValidWrite(writePath, frame.object || frame.file, frame.method);
    }
}

var ResetInterval = 1000 * 60 * 60 * 2,
    UseLazyResets = false;

module.exports = GameServer;
