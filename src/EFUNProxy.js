/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    stack = require('callsite'),
    async = require('async'),
    path = require('path'),
    os = require('os'),
    sprintf = require('sprintf').sprintf,
    { MUDConfig } = require('./MUDConfig'),
    ErrorTypes = require('./ErrorTypes'),
    EventEmitter = require('events'),
    util = require('util'),
    fs = require('fs'),
    vm = require('vm');

const
    KiloByte = 1024,
    MegaByte = KiloByte * 1000,
    GigaByte = MegaByte * 1000,
    TeraByte = GigaByte * 1000,
    _symbols = '_symbols',
    _unguarded = '_unguarded';

var
    MUDData = require('./MUDData'),
    EFUNS = require('./EFUNS'),
    { MUDHtmlComponent } = require('./MUDHtml'),
    _ruleCache = {};

MUDData.MasterEFUNS = new EFUNS();

class EFUNProxy extends EventEmitter {
    constructor() {
        super();
        this[_unguarded] = false;
        this[_symbols] = {};
    }

    defineSymbol(name) {
        if (typeof name !== 'string' || name.length === 0)
            throw new Error('Bad argument 1 to defineSymbol; Expected string got {0}'.fs(typeof name));
        if (typeof this[_symbols][name] !== 'symbol') {
            this[_symbols][name] = Symbol(name);
        }
        return this[_symbols][name];
    }

    get isUnguarded() {
        return this[_unguarded];
    }
}

Object.defineProperties(EFUNProxy.prototype, {
    abs: {
        value: function (n) {
            return Math.abs(n);
        },
        writable: false
    },
    activePermissions: {
        value: function () {
            var seen = {}, perms = [], s = stack();
            if (MUDData.ActivePerms) {
                return MUDData.ActivePerms.permissions;
            }
            s.forEach(cs => {
                var fn = cs.getFileName(),
                    mp = MUDData.MasterEFUNS.pathToMudPath(fn);

                if (mp && !seen[mp]) {
                    var wext = mp.replace(/\.js[x]*$/, ''),
                        module = MUDData.ModuleCache.get(wext);

                    if (module) {
                        perms.pushDistinct(...module.efunProxy.permissions);
                        seen[wext] = true;
                    }
                }
            });
            return perms;
        },
        writable: false
    },
    addAction: {
        value: function (verb, callback) {
            var prevObject = this.previousObject(),
                thisObject = this.thisObject();
            if (prevObject) {
                prevObject.bindAction(verb, thisObject, callback);
            }
        }
    },
    adminp: {
        value: function (target) {
            return MUDData.MasterObject.inGroup(target, 'admin');
        },
        writable: false
    },
    archp: {
        value: function (target) {
            return MUDData.MasterObject.inGroup(target, 'arch', 'admin');
        },
        writable: false
    },
    arrayToSentence: {
        value: function (list, useOr, consolidate, useNumbers) {
            useOr = typeof useOr === 'boolean' ? useOr : false;
            consolidate = typeof consolidate === 'boolean' ? consolidate : true;
            useNumbers = typeof useNumbers === 'boolean' ? useNumbers : false;

            list = list.map(function (o) {
                var uw = unwrap(o);
                return uw ? uw.shortDescription : o.toString();
            });

            if (consolidate) {
                var uniq = {}, count = 0;
                list.forEach(s => {
                    if (!uniq[s]) { uniq[s] = 0; count++; }
                    uniq[s]++;
                });
                if (count === 0) return '';
                list = Object.mapEach(uniq, (k, v) => {
                    return '{0} {1}'.fs(
                        useNumbers ? v.toString() : this.cardinal(v),
                        v > 1 ? this.pluralize(k) : k);
                });
            }
            var len = list.length;
            if (len === 0)
                return '';
            else if (len === 1)
                return list[0];
            else if (len === 2)
                return list[0] + (useOr ? ' or ' : ' and ') + list[1];
            else
                return list.slice(0, len - 1).join(', ') +
                    (useOr ? ' or ' : ' and ') + list[len - 1];
        },
        writable: false
    },
    assemble_class: {
        value: function (arr) {
            var s = '(function() { return function(o) {\n';
            if (Array.isArray(arr)) {
                arr.forEach(el => s += `  this.${el} ` + '= typeof o === \'object\' ? o.' + el + ' : undefined;\n');
                s += '};})()';
                return eval(s);
            }
            else throw new Error(`Bad argument 1 to assemble_class(); Expected array got ${typeof arr}`);
        },
        writable: false
    },
    checkPassword: {
        value: function (plain, crypto, callback) {
            return MUDData.Config.mud.passwordPolicy.checkPassword(plain, crypto, callback);
        },
        writable: false
    },
    cloneObject: {
        value: function (file) {
            if (arguments.length === 0)
                throw new Error('Bad call to cloneObject; Expected string got null');
            var args = [].slice.apply(arguments), filename = this.resolvePath(args[0], this.directory + '/');
            if (MUDData.MasterObject.validRead(this, filename)) {
                var module = MUDData.ModuleCache.get(filename);
                if (!module || !module.loaded) {
                    MUDData.Compiler(filename);
                    module = MUDData.ModuleCache.get(filename);
                }
                if (module) {
                    if (module.singleton)
                        throw new ErrorTypes.SecurityError(filename + ' is a singleton and cannot be cloned');
                    return module.createInstance(-1, false, args[1]);
                }
                return false;
            }
            throw new ErrorTypes.SecurityError();
        },
        writable: false
    },
    consolidateArray: {
        value: function (arr) {
            var shorts = {},
                strings = arr.map(s => {
                    if (typeof s === 'string')
                        return s;
                    var uw = unwrap(s);
                    return uw ? uw.shortDescription : false;
                }).filter(s => s !== false);
            strings.forEach(s => {
                if (typeof shorts[s] === 'undefined')
                    shorts[s] = 0;
                shorts[s]++;
            });
            return Object.keys(shorts).map(s => {
                return this.consolidate(shorts[s], s).ucfirst();
            });
        },
        writable: false
    },
    createPassword: {
        value: function (str, callback) {
            MUDData.Config.mud.passwordPolicy.hashPasword(str, callback);
        },
        writable: false
    },
    deepInventory: {
        value: function (target, callback) {
            var _async = typeof callback === 'function',
                o = unwrap(target);

            if (o) {
                var result = target.inventory || [],
                    leftToCheck = result.slice(0);
                while (leftToCheck.length > 0) {
                    var _inner = unwrap(leftToCheck.shift()),
                        _inv = _inner ? _inner.inventory : [];

                    if (result.indexOf(_inner) === -1)
                        result.push(_inner);

                    _inv.forEach(_o => {
                        if (result.indexOf(_o) === -1)
                            result.push(_o);
                    });
                }
                return result;

            }
            return false;
        },
        writable: false
    },
    exec: {
        value: function (oldBody, newBody, client, callback) {
            if (typeof client === 'function') {
                callback = client;
                client = false;
            }
            if (MUDData.MasterObject.validExec(this, oldBody, newBody, client)) {
                var oldContainer = oldBody ? MUDData.Storage.get(oldBody) : false,
                    newContainer = MUDData.Storage.get(newBody),
                    client = oldContainer.getProtected('client'),
                    execEvent = {
                        oldBody: oldBody,
                        oldStorage: oldContainer,
                        newBody: newBody,
                        newStorage: newContainer,
                        client: client
                    };

                if (oldContainer) oldContainer.emit('kmud.exec', execEvent);
                newContainer.setProtected('client', client).emit('kmud.exec', execEvent);
                MUDData.MasterObject.emit('kmud.exec', execEvent);

                if (!client) client = thisPlayer.client;
                if (typeof client === 'object') {
                    if (MUDData.MasterObject.exec(oldBody, newBody, client)) {
                        if (typeof callback === 'function')
                            callback.call(oldBody, newBody);
                        return true;
                    }
                }
                return false;
            }
            throw new Error('Permission denied: ' + expr);
        },
        writable: false
    },
    featureEnabled: {
        value: function (feature) {
            let result = MUDData.Config.readValue(`mud.features.${feature}`, false);
            return result === true;
        },
        writable: false
    },
    findObject: {
        value: function (filename) {
            var parts = filename.split('#', 2),
                basename = parts[0],
                instanceId = parts.length === 1 ? 0 : parseInt(parts[1]),
                module = MUDData.ModuleCache.get(basename);
            if (module) {
                return module.wrappers[instanceId] || false;
            }
            return false;
        },
        writable: false
    },
    findPlayer: {
        value: function (name, partial) {
            if (typeof name !== 'string')
                throw new Error('Bad argument 1 to findPlayer; Expects string got {0}'.fs(typeof name));
            var search = name.toLowerCase().replace(/[^a-zA-Z0-9]+/g, ''), len = search.length,
                matches = MUDData.Players.filter(p => {
                    return p().getName() === search || (partial && p().getName().slice(0, len) === search);
                });
            return matches.length === 1 ? matches[0] : false;
        },
        writable: false
    },
    getDir: {
        value: function (expr, flags, cb) {
            if (typeof flags === 'function') (cb = flags), (flags = 0);
            return this.resolvePath(expr, (fullpath) => {
                if (MUDData.MasterObject.validRead(this, fullpath)) {
                    return MUDData.MasterEFUNS.getDir(MUDData.MasterEFUNS.mudPathToAbsolute(fullpath), flags, cb);
                }
                throw new Error('Permission denied: ' + expr);
            });
        },
        writable: false
    },
    getProxy: {
        value: function (n) {
            var module = MUDData.ModuleCache.get(this.filename);
            return module.getProxy(n);
        },
        writable: false
    },
    getStack: {
        value: function () {
            var result = [];
            stack().forEach(sf => {
                result.push({
                    filename: sf.getFileName() || '[Unknown File]',
                    function: (sf.getFunction() || '').toString(),
                    functionName: sf.getFunctionName() || '[Anonymous]',
                    methodName: sf.getMethodName() || '',
                    foo: sf.getTypeName() || ''
                });
            });
            return JSON.stringify(result, null, 3);
        },
        writable: false
    },
    getMemSizeString: {
        value: function (n) {
            var numeric = parseInt(n);
            if (isNaN(numeric))
                return 'invalid';
            if (numeric > TeraByte) {
                return Math.round10(numeric / TeraByte, -2) + 'TB';
            }
            else if (numeric > GigaByte) {
                return Math.round10(numeric / GigaByte, -2) + 'GB';
            }
            else if (numeric > MegaByte) {
                return Math.round10(numeric / MegaByte, -2) + 'MB';
            }
            else if (numeric > KiloByte) {
                return Math.round10(numeric / KiloByte, -2) + 'KB';
            }
            else {
                return numeric + 'B';
            }
        },
        writable: false
    },
    hasBrowser: {
        value: function (target) {
            var o = unwrap(target);
            return (typeof o === 'object') &&
                (typeof o.client === 'object') &&
                (o.client.isBrowser === true);
        }
    },
    includePath: {
        value: function (file) {
            var files = [].slice.apply(arguments),
                includePath = MUDData.MasterObject.includePath;

            if (files.length > 0) {
                var result = [], inc =
                    files.forEach(fn => {
                        includePath.forEach(dir => {
                            var path = this.resolvePath(fn, dir);
                            if (!path.endsWith('.js')) path += '.js';
                            result.push(path);
                        });
                    });
                return result;
            }
            return MUDData.MasterObject.includePath;
        },
        writable: false
    },
    isDirectory: {
        value: function (dirpath, callback) {
            if (MUDData.MasterObject.validRead(this, dirpath)) {
                return MUDData.MasterEFUNS.isDirectory(MUDData.MasterEFUNS.mudPathToAbsolute(dirpath), callback);
            }
            throw new Error('Permission denied: ' + dirpath);
        },
        writable: false
    },
    isClass: {
        value: function (o) {
            return /\s*class /.test(o.toString());
        },
        writable: false
    },
    isClone: {
        value: function (o) {
            var target = unwrap(o);
            return typeof target === 'object' && target.instanceId > 0;
        },
        writable: false
    },
    isFile: {
        value: function (filepath, cb) {
            if (MUDData.MasterObject.validRead(this, filepath)) {
                return MUDData.MasterEFUNS.isFile(MUDData.MasterEFUNS.mudPathToAbsolute(filepath), cb);
            }
            throw new ErrorTypes.SecurityError();
        },
        writable: false
    },
    isLiving: {
        value: function (target) {
            var o = unwrap(target);
            return o === false ? false : typeof o.dispatchInput === 'function';
        },
        writable: false
    },
    ifPermission: {
        value: function (perms, callback) {
            var ap = this.activePermissions();
            if (typeof perms === 'string')
                perms = [perms];
            if (Array.isArray(perms)) {
                for (var i = 0, max = perms.length; i < max; i++) {
                    if (ap.indexOf('ROOT') > -1) break;
                    if (ap.indexOf(perms[i]) < 0) return false;
                }
                return callback.call(this);
            }
            return false;
        },
        writable: false
    },
    loadObject: {
        value: function (path, args) {
            var filename = this.resolvePath(path);
            if (MUDData.MasterObject.validRead(this, filename)) {
                var module = MUDData.ModuleCache.get(filename);
                if (module && module.loaded) {
                    if (module.instances[0])
                        return module.getWrapper(0);
                    else
                        return module.createInstance(0, false, args);
                }
                else {
                    module = MUDData.Compiler(filename, false, undefined, args);
                    return module ? module.getWrapper(0) : false;
                }
            }
            throw new ErrorTypes.SecurityError();
        },
        writable: false
    },
    message: {
        value: function (messageType, expr, ...audience) {
            if (expr && MUDData.ThisPlayer) {
                if (typeof expr !== 'string') {
                    if (expr instanceof MUDHtmlComponent)
                        expr = expr.render();
                    else if (typeof expr === 'number')
                        expr = expr.toString();
                    else
                        throw new Error(`Bad argument 2 to message; Expected string, number, or MUDHtmlComponent but received ${typeof expr}`);
                }
                audience.forEach(a => {
                    if (Array.isArray(a))
                        this.message(messageType, expr, a);
                    else unwrap(a, a => a.receive_message(messageType, expr));
                });
            }
        }
    },
    mkdir: {
        value: function (path, callback) {
            var filename = this.resolvePath(path);
            if (MUDData.MasterObject.validWrite(this, filename)) {
                var absPath = MUDData.MasterEFUNS.mudPathToAbsolute(filename);
                return MUDData.MasterEFUNS.mkdir(absPath, callback);
            }
            throw new ErrorTypes.SecurityError();
        },
        writable: false
    },
    mudInfo: {
        value: function () {
            return {
                arch: os.arch(),
                architecture: os.platform(),
                cpuUsage: process.cpuUsage().user,
                gameDriver: 'Node.js v' + process.versions.node,
                hardware: (function () {
                    var cpus = {}, r = [];
                    os.cpus().forEach((cpu, i) => {
                        if (!cpus[cpu.model]) cpus[cpu.model] = 0;
                        cpus[cpu.model]++;
                    });
                    for (var k in cpus) {
                        r.push(k + " x " + cpus[k]);
                    }
                    return r.join('');
                })(),
                mudlibName: 'KMUD',
                mudlibBaseVersion: 'KMUD 0.3',
                mudlibVersion: 'Emerald MUD 2.0',
                mudMemoryTotal: this.getMemSizeString(process.memoryUsage().heapTotal),
                mudMemoryUsed: this.getMemSizeString(process.memoryUsage().heapUsed),
                name: MUDData.MasterObject.mudName,
                osbuild: os.type() + ' ' + os.release(),
                serverAddress: MUDData.MasterObject.serverAddress,
                systemMemoryUsed: this.getMemSizeString(os.totalmem() - os.freemem()),
                systemMemoryPercentUsed: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100.0,
                systemMemoryTotal: this.getMemSizeString(os.totalmem()),
                uptime: new Date().getTime() - MUDData.MasterObject.startTime
            };
        },
        writable: false
    },
    mudName: {
        value: function () { return MUDData.MasterObject.mudName; },
        writable: false
    },
    normalizeName: {
        value: function (name) {
            if (typeof name !== 'string')
                throw new Error('Bad argument 1 to normalizeName; Expected string got {0}'.fs(typeof name));
            return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
        },
        writable: false
    },
    playerp: {
        value: function (target) {
            var o = unwrap(target);
            return (typeof o === 'object') &&
                (typeof o.dispatchInput === 'function') &&
                (o.filename.startsWith('/v/sys/data/players/'));
        },
        writable: false
    },
    players: {
        value: function (showAll) {
            return MUDData.Players.map(p => unwrap(p)).filter(player => {
                if (!player.connected && !showAll)
                    return false;
                return true;
            });
        },
        writable: false
    },
    pluralize: {
        value: function (what) {
            return MUDData.MasterEFUNS.pluralize(what);
        },
        writable: false
    },
    previousObject: {
        value: (function () {
            if (MUDConfig.driver.useObjectProxies) {
                //  If useObjectProxies is on then the driver maintains an object stack.
                return function (n) {
                    let thisObject = MUDData.ObjectStack[0] || false,
                        index = (n || 0) + 1, prev = null;
                    if (n === -1) {
                        return MUDData.ObjectStack.slice(0)
                            .filter(o => o === prev ? false : (prev = o), true);
                    }
                    return MUDData.ObjectStack[index] || thisObject || false;
                };
            }
            else if (MUDConfig.driver.objectCreationMethod === 'inline') {
                //  If objects are created inline without a wrapper class then it is 
                //  impossible to determine the instance of the calling object unless
                //  safe mode is turned off... which seems unlikely.
                return function (n) {
                    let objectStack = [], index = (n || 0) + 1;
                    stack().forEach((cs, i) => {
                        let fn = cs.getFileName();
                        if (typeof fn === 'string' && !fn.startsWith(MUDData.DriverPath)) {
                            let mudPath = MUDData.RealPathToMudPath(fn);
                            let module = MUDData.ModuleCache.get(mudPath);
                            if (module) {
                                let ob = unwrap(module.getWrapper(0));
                                if (objectStack[0] !== ob) objectStack.unshift(ob);
                            }
                        }
                    });
                    return n === -1 ? objectStack.reverse() : objectStack[index];
                };
            }
            else /* creation method must be one of the wrapper varities */ {
                return function (n) {
                    let objectStack = [], index = (n || 0) + 1;
                    stack().forEach((cs, i) => {
                        let fn = cs.getFileName();
                        if (typeof fn === 'string' && !fn.startsWith(MUDData.DriverPath)) {
                            let fileParts = fn.split('#');
                            let module = MUDData.ModuleCache.get(fileParts[0]),
                                instanceId = fileParts.length === 0 ? 0 : parseInt(fileParts[1]);
                            if (module) {
                                let ob = unwrap(module.getWrapper(instanceId));
                                if (objectStack[0] !== ob) objectStack.unshift(ob);
                            }
                        }
                    });
                    return n === -1 ? objectStack.reverse() : objectStack[index];
                };
            }
        })(),
        writable: false
    },
    readFile: {
        value: function (filename, callback) {
            var _file = this.resolvePath(filename);
            if (MUDData.MasterObject.validRead(this, filename)) {
                return this.stripBOM(MUDData.MasterEFUNS.readFile(MUDData.MasterEFUNS.mudPathToAbsolute(_file), callback));
            }
            throw new Error('Permission denied: ' + filename);
        },
        writable: false
    },
    readConfig: {
        value: function (key, defaultValue) {
            if (MUDData.MasterObject.validReadConfig(this.thisObject(), key))
                return MUDData.Config.readValue(key, defaultValue);
            return false;
        },
        writable: false
    },
    readJsonFile: {
        value: function (filename, callback) {
            var _async = typeof callback === 'function',
                _filename = this.resolvePath(filename);
            if (MUDData.MasterObject.validRead(this, _filename)) {
                if (_async)
                    return MUDData.MasterEFUNS.readFile(MUDData.MasterEFUNS.mudPathToAbsolute(_filename), (data, err) => {
                        try {
                            if (err) {
                                return callback(null, err);
                            }
                            var result = JSON.parse(data);
                            callback(result, false);
                        }
                        catch (e) {
                            callback(null, 'readJsonFile: Error: ' + e);
                            throw e;
                        }
                    });
                else {
                    try {
                        var result = JSON.parse(MUDData.MasterEFUNS.readFile(MUDData.MasterEFUNS.mudPathToAbsolute(_filename)));
                        return result;
                    }
                    catch (e) {
                        throw new Error('Unable to parse file');
                    }
                }
            }
            throw new Error('Permission denied: ' + filename);
        },
        writable: false
    },
    reloadObject: {
        value: function (path) {
            var filename = this.resolvePath(path);
            if (MUDData.MasterObject.validRead(this, filename)) {
                var result = MUDData.Compiler(filename, true);
                return result === false ? false : true;
            }
            throw new ErrorTypes.SecurityError();
        },
        writable: false
    },
    removeAction: {
        value: function (verb, callback) {
            var prevObject = this.previousObject(),
                thisObject = this.thisObject();
            if (prevObject) {
                prevObject.unbindAction(verb, thisObject, callback);
            }
        }
    },
    resolvePath: {
        value: function (expr, expr2, callback) {
            if (typeof expr2 === 'function') {
                callback = expr2;
                expr2 = false;
            }
            else if (typeof expr2 !== 'string') {
                expr2 = false;
            }
            if (expr[0] === '~') {
                var re = /^~([\\\/])*([^\\\/]+)/, m = re.exec(expr) || [];
                if (m.length === 2) {
                    expr = '/realms/' + m[2] + expr.slice(m[2].length + 1);
                }
                else if (expr[1] === '/' || expr === '~') {
                    expr = MUDData.ThisPlayer ? '/realms/' + MUDData.ThisPlayer.getName() + expr.slice(1) : self.homeDirectory + expr.slice(1);
                }
                else if (m.length === 3 && !m[1]) {
                    expr = '/realms/' + expr.slice(1);
                }
            }
            var result = expr.startsWith('/') ?
                path.join('/', expr.substr(1)).replace(/\\/g, '/') :
                path.join(expr2 || this.directory, expr).replace(/\\/g, '/');
            return typeof callback === 'function' ? callback(result) : result;
        },
        writable: false
    },
    rm: {
        value: function (path, callback) {
            var filename = this.resolvePath(path);
            if (MUDData.MasterObject.validWrite(this, filename)) {
                var absPath = MUDData.MasterEFUNS.mudPathToAbsolute(filename);
                return MUDData.MasterEFUNS.rm(absPath);
            }
            throw new ErrorTypes.SecurityError();
        },
        writable: false
    },
    rmdir: {
        value: function (path, callback) {
            var filename = this.resolvePath(path);
            if (MUDData.MasterObject.validWrite(this, filename)) {
                var absPath = MUDData.MasterEFUNS.mudPathToAbsolute(filename);
                return MUDData.MasterEFUNS.rmdir(absPath);
            }
            throw new ErrorTypes.SecurityError();
        },
        writable: false
    },
    setTimeout: {
        value: function (cb) {
            var args = [].slice.apply(arguments),
                target = args.shift(),
                delay = args.shift();
        },
        writable: false
    },
    shutdown: {
        value: function (errCode, reason) {
            if (MUDData.MasterObject.validShutdown(this)) {
                process.exit(errCode || 0);
            }
        },
        writable: false
    },
    sprintf: {
        value: sprintf,
        writable: false
    },
    stripBOM: {
        value: MUDData.MasterEFUNS.stripBOM,
        writable: false
    },
    thisObject: {
        value: function () {
            return MUDData.ObjectStack[0] || false;
        },
        writable: false
    },
    unguarded: {
        value: function (callback) {
            var result = false, oldStack = MUDData.ObjectStack;
            try {
                this[_unguarded] = true;
                MUDData.ActivePerms = this;
                MUDData.ObjectStack = MUDData.ObjectStack.slice(0, 1);
                result = callback();
            }
            catch (_e) {
                MUDData.ActivePerms = this[_unguarded] = false;
                console.log(_e);
                throw _e;
            }
            finally {
                MUDData.ObjectStack = oldStack;
            }
            MUDData.ActivePerms = this[_unguarded] = false;
            return typeof result === 'undefined' ? this : result;
        },
        writable: false
    },
    userp: {
        value: function (target) {
            return this.playerp(target) || this.wizardp(target);
        },
        writable: false
    },
    validPassword: {
        value: function (str) {
            return MUDData.Config.mud.passwordPolicy.validPassword(str);
        },
        writable: false
    },
    wizardp: {
        value: function (target) {
            return MUDData.MasterObject.inGroup(target, 'admin', 'arch', 'wizard');
        },
        writable: false
    },
    write: {
        value: function (expr) {
            this.message('write', expr, MUDData.ThisPlayer);
            return true;
        },
        writable: false
    },
    writeFile: {
        value: function (filename, content, callback) {
            var _async = typeof callback === 'function',
                _filename = this.resolvePath(filename),
                _absfile = MUDData.MasterEFUNS.mudPathToAbsolute(_filename);

            if (MUDData.MasterObject.validWrite(this, _filename)) {
                return MUDData.MasterEFUNS.writeFile(_absfile, content, callback);
            }
            throw new Error('Permission denied: ' + _filename);
        },
        writable: false
    },
    writeJsonFile: {
        value: function (filename, data, callback, replacer) {
            var _async = typeof callback === 'function',
                _filename = this.resolvePath(filename),
                _absfile = MUDData.MasterEFUNS.mudPathToAbsolute(_filename);

            if (MUDData.MasterObject.validWrite(this, _filename)) {
                return MUDData.MasterEFUNS.writeFile(_absfile, JSON.stringify(data, replacer, 3), callback);
            }
            throw new Error('Permission denied: ' + _filename);
        },
        writable: false
    }
});

/**
 * @param {string} filename File to create proxy for.
 */
EFUNProxy.createEfunProxy = function (filename) {
    var wrapper = new EFUNProxy(),
        parts = filename.length > 1 ? filename.split('/') : [],
        directory = parts.length > 1 ? parts.slice(0, parts.length - 1).join('/') : '/',
        perms = [];

    if (MUDData.InGameMaster) {
        perms = MUDData.InGameMaster().getPermissions(filename);
    }
    else if (MUDData.MasterObject) {
        if (filename === MUDData.MasterObject.masterFilename) {
            perms = ['ROOT'];
        }
    }
    else if (filename === '/') {
        perms = ['ROOT'];
    }
    return (function (w, fn, p) {
        var hd = directory;
        p.forEach(function (s, i) {
            if (s.startsWith('REALM:'))
                hd = '/realms/' + s.slice(6);
            else if (s.startsWith('DOMAIN:'))
                hd = '/world/' + s.slice(7);
        });
        Object.defineProperties(w, {
            directory: { value: directory, writable: false, enumerable: true },
            filename: { value: fn, writable: false, enumerable: true },
            homeDirectory: { value: hd, writable: false, enumerable: true },
            permissions: { value: p, writable: false, enumerable: true }
        });
        return Object.seal(w);
    })(wrapper, filename, perms);

};

MUDData.SpecialRootEfun = EFUNProxy.createEfunProxy('/');

module.exports = EFUNProxy;

