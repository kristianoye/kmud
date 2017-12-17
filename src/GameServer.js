/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var
    Mudlib = require('./MudLib'),
    MUDData = require('./MUDData'),
    { MUDConfig } = require('./MUDConfig');

const
    _config = '_CONFIG_',
    fs = require('fs'),
    path = require('path'),
    os = require('os'),
    ClientEndpoint = require('./network/ClientEndpoint'),
    EFUNProxy = require('./EFUNProxy'),
    EventEmitter = require('events'),
    HTTPClientEndpoint = require('./network/HTTPClientEndpoint'),
    TelnetClientEndpoint = require('./network/TelnetClientEndpoint'),
    MUDCompiler = require('./MUDCompiler');

class GameServer extends EventEmitter {
    /**
     * Construct a new game server
     * @param {MUDConfig} config The configuration object.
     */
    constructor(config) {
        super();

        this[_config] = config;


        if (!this.config) {
            throw new Error('Arg!');
        }

        this.setSimulEfunPath(config.mudlib.simulEfuns);

        MUDData.MasterObject = MUDData.MasterObject = this;
        MUDData.GameState = MUDData.Constants.GAMESTATE_INITIALIZING;

        this.connections = [];
        this.startTime = new Date().getTime();

        this.addressList = { '127.0.0.1': true };
        this.compiler = MUDData.CompilerInstance = new MUDCompiler(config.driver.compiler);
        this.endpoints = [];
        this.errorHandler = function () { return 1; };
        this.heartbeatCounter = 0;
        this.includePath = config.mudlib.includePath || [];
        this.masterFilename = config.mudlib.inGameMaster.path;
        this.mudName = config.mud.name;
        this.preloads = [];

        this.heartbeatInterval = config.mudlib.heartbeatInterval;
        this.logDirectory = config.mudlib.logDirectory;

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
                        console.log(ifname + ':' + alias, iface.address);
                    } else {
                        // this interface has only one ipv4 adress
                        console.log(ifname, iface.address);
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
            if (binding.port < 1024 || binding.port > 49151)
                throw 'Illegal port value; Must be greater than 1024 and less than 49152';

            console.log(`Adding ${binding.type} ${binding.address} port ${binding.port}`);

            var endpointConfig = config.driver.networking.endpoints.getEndpointConfig(binding.type),
                handlerConfig = endpointConfig.getHandler(binding.handlerType || false),
                handlerModule = require(handlerConfig.file),
                handlerType = handlerConfig.type ? handlerModule[handlerConfig.type] : handlerModule,
                endpoint = new handlerType(this, binding);

            return endpoint;
        });
    }

    /**
     * @returns {MUDConfig}
     */
    get config() {
        return this[_config];
    }

    addPlayer(body) {
        var _body = body ? unwrap(body) : false;
        if (_body && typeof _body.save === 'function') {
            MUDData.Players.pushDistinct(body);
        }
        return this;
    }

    createMasterObject() {
        let config = this.config.mudlib, self = this,
            startupArgs = {
                args: Object.extend({ driver: this, resolver: MUDData.MudPathToRealPath }, config.inGameMaster.parameters)
            };

        let _inGameMaster = MUDData.Compiler(config.inGameMaster.path, false, undefined, startupArgs);

        if (!_inGameMaster) {
            throw new Error('In-game master could not be loaded; Abort!');
        }

        this.masterObject = unwrap(MUDData.InGameMaster = _inGameMaster.getWrapper(0));

        function locateApply(name, required) {
            let func = self.masterObject[config.applyNames[name] || name];
            if (typeof func !== 'function' && required === true)
                throw new Error(`Invalid master object; Could not locate required ${name} apply: ${(config.applyNames[name] || 'validRead')}`);
            return func || false;
        }

        /* validate in-game master */
        this.applyGetPreloads = locateApply('getPreloads', false);
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

    mergeEfuns(simul) {
        if (simul) {
            var wrapper = simul.wrapper;
            var proto = simul.constructor.prototype;
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
                        console.log('Error merging efuns: ' + x);
                    }
                })(method, proto[method]);
            });
        }
    }

    createPreloads() {
        if (this.applyGetPreloads !== false) {
            this.preloads = this.applyGetPreloads.apply(this.masterObject);
        }
        if (this.preloads.length > 0) {
            console.log('Creating preloads...');
            this.preloads.forEach(function (file, i) {
                var t0 = new Date().getTime();
                var foo = file instanceof Array ?
                    MUDData.Compiler(file[0], undefined, undefined, file.slice(1)) :
                    MUDData.Compiler(file);
                var t1 = new Date().getTime();
                console.log('\tPreload: {0}: {1} [{2} ms]'.fs(file, foo ? '[OK]' : '[Failure]', t1 - t0));
            });
        }

    }

    createSimulEfuns() {
        if (this.simulEfunPath) {
            MUDData.Compiler(this.simulEfunPath);
        }
    }

    enableGlobalErrorHandler() {
        this.globalErrorHandler = true;
        return this;
    }

    exec(oldBody, newBody, client, callback) {
        var result = false;
        try {
            if (MUDData.Clients.indexOf(client) > -1) {
                MUDData.SpecialRootEfun.unguarded(() => {
                    result = client.setBody(newBody);
                    if (result && typeof callback === 'function')
                        callback.call(oldBody, newBody);
                });
            }
        }
        catch (e) {
            result = false;
        }
        return true;
    }

    executeHeartbeat() {
        try {
            this.emit('kmud.heartbeat', this.heartbeatInterval, ++this.heartbeatCounter);
        }
        catch (e) {
            console.log('Error in executeHeartbeat: ' + e);
        }
    }

    extendGlobals() {
        global.Array.prototype.pushDistinct = function (...list) {
            list.forEach(e => {
                var n = this.indexOf(e);
                if (n === -1) this.push(e);
            });
        };
    }

    getAddress() {
        return this.serverAddress;
    }

    getMudName() {
        return this.MudName;
    }

    inGroup(target, groups) {
        if (MUDData.GameState < MUDData.Constants.GAMESTATE_RUNNING) return true;
        else return MUDData.InGameMaster().inGroup(target, [].slice.call(arguments, 1));
    }

    isVirtualPath(path) {
        return this.virtualPrefix ? path.startsWith(this.virtualPrefix) : false;
    }

    /**
     * Registers an error handler.
     * @param {function} callback The function that is executed upon error.  A return value of 1 indicates the MUD should restart.
     * @returns {GameServer} The instance of the GameServer is returned.
     */
    setErrorHandler(callback) {
        if (typeof callback !== 'function')
            throw 'Error handler must be a valid function.';
        this.errorHandler = callback;
        return this;
    }

    setLoginObject(path) {
        this.loginObject = path;
        return this;
    }

    setPermissionsFile(file) {
        this.permissionsFile = file;
        return this;
    }

    setPreloads(list) {
        this.preloads = list;
        return this;
    }

    setPreloadsFile(file) {
        this.preloadsFile = file;
        return this;
    }

    setServerAddress(addr) {
        if (!this.addressList[addr])
            throw new Error('Specified address ({0}) is not available; Possible choices are {1}'
                .fs(addr, Object.keys(this.addressList).join(', ')));
        this.serverAddress = addr;
        return this;
    }

    setSimulEfunPath(sim) {
        this.simulEfunPath = '/sys/lib/SimulEfuns';
        return this;
    }

    /**
     * Runs the MUD
     * @param {function?} callback Callback to execute when the MUD is running.
     * @returns {GameServer} A reference to the GameServer.
     */
    run(callback) {
        var self = this, i, hbTimer;

        if (!this.loginObject) {
            throw new Error('Login object must be specified');
        }
        console.log('Starting %s', this.mudName);
        if (this.globalErrorHandler) {
            process.on('uncaughtException', err => {
                console.log(err);
                console.log(err.stack || err.trace || '[No Trace]');
            });
            if (this.errorHandler) {
                process.on('uncaughtException', this.errorHandler);
            }
        }
        this.createSimulEfuns();
        this.createMasterObject();

        MUDData.GameState = MUDData.Constants.GAMESTATE_STARTING;

        this.createPreloads();

        for (i = 0; i < this.endpoints.length; i++) {
            this.endpoints[i]
                .bind()
                .on('kmud.connection', (client) => {
                    var newLogin = MUDData.SpecialRootEfun.cloneObject(this.config.mudlib.loginObject);

                    MUDData.Storage.get(newLogin).setProtected('client', client,
                        ($storage, _client) => {
                            var evt = { newBody: newLogin, client: _client };
                            self.emit('kmud.exec', evt);
                            $storage.emit('kmud.exec', evt);
                        });

                    MUDData.Clients.push(client);
                })
                .on('kmud.connection.new', function (client, protocol) {
                    console.log(`New ${protocol} connection from ${client.remoteAddress}`);
                    self.connections.push(client);
                })
                .on('kmud.connection.closed', function (client, protocol) {
                    console.log(`${protocol} connection from ${client.remoteAddress} closed.`);
                    MUDData.Clients.removeValue(client);
                    self.connections.removeValue(client);
                })
                .on('kmud.connection.full', function (c) {
                    c.write('The game is all full, sorry; Please try again later.\n');
                    c.close();
                })
                .on('kmud.connection.timeout', function (c, p) {
                    console.log('A %s connection from %s timed out', p, c.remoteAddress);
                });
        }
        if (typeof callback === 'function') callback.call(this);
        var startupTime = new Date().getTime() - this.startTime, startSeconds = startupTime / 1000;
        console.log('Startup took {0} seconds [{1} ms]'.fs(startSeconds, startupTime));
        MUDData.GameState = MUDData.Constants.GAMESTATE_RUNNING;
        if (this.heartbeatInterval > 100) {
            hbTimer = setInterval(() => {
                this.executeHeartbeat();
            }, this.heartbeatInterval);
        }
        return this;
    }

    setHeartbeatInterval(delay) {
        this.heartbeatInterval = delay;
        return this;
    }

    removePlayer(body) {
        var _body = unwrap(body);
        if (_body && typeof _body.save === 'function') {
            MUDData.Players.removeValue(body);
        }
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

    setThisPlayer(body) {
        try {
            MUDData.ThisPlayer = unwrap(body);
        }
        catch (e) {
            throw e;
        }
    }

    setVirtualPrefix(path) {
        this.virtualPrefix = path;
        return this;
    }

    unguarded(callback, thisObject, args) {
        MUDData.SpecialRootEfun.unguarded(() => {
            return callback.apply(thisObject || this, args || []);
        });
    }

    validExec(oldBody, newBody) {
        if (MUDData.GameState < MUDData.Constants.GAMESTATE_RUNNING)
            return false;
        else if (this.applyValidExec === false) return true;
        else return this.applyValidExec.apply(this.masterObject, arguments);
    }

    validObject(ob) {
        if (MUDData.GameState === MUDData.Constants.GAMESTATE_INITIALIZING)
            return true;
        else if (ob.filename === this.simulEfunPath) {
            console.log('\tRe-merging SimulEfuns...');
            this.mergeEfuns(ob);
            return true;
        }
        else if (!this.applyValidObject) return true;
        else return MUDData.InGameMaster().validObject(ob);
    }

    validReadConfig(caller, key) {
        if (MUDData.GameState === MUDData.Constants.GAMESTATE_STARTING)
            return true;
        else if (!this.applyValidReadConfig) return true;
        else return MUDData.InGameMaster().validReadConfig(caller, key);
    }

    validRead(efuns, path) {
        if (MUDData.GameState < MUDData.Constants.GAMESTATE_RUNNING)
            return true;
        else
            return this.applyValidRead.apply(this.masterObject, arguments);
    }

    validShutdown(efuns) {
        if (MUDData.GameState !== MUDData.Constants.GAMESTATE_RUNNING)
            return true;
        else if (!this.applyValidShutdown) return true;
        else return MUDData.InGameMaster().validShutdown(efuns);
    }

    validWrite(efuns, path) {
        if (MUDData.GameState < MUDData.Constants.GAMESTATE_INITIALIZING)
            return true;
        else
            return this.applyValidWrite.apply(this.masterObject, arguments);
    }
}

module.exports = GameServer;
