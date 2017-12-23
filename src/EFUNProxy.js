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
    MUDExecutionContext = require('./MUDExcecutionContext'),
    { DomainStatsContainer } = require('./features/DomainStats'),
    util = require('util'),
    fs = require('fs'),
    vm = require('vm');

const
    KiloByte = 1024,
    MegaByte = KiloByte * 1000,
    GigaByte = MegaByte * 1000,
    TeraByte = GigaByte * 1000,
    _unguarded = '_unguarded';

var
    MUDData = require('./MUDData'),
    EFUNS = require('./EFUNS'),
    { MUDHtmlComponent } = require('./MUDHtml'),
    _ruleCache = {};

MUDData.MasterEFUNS = new EFUNS();

class EFUNProxy {
    constructor(_thisObject)
    {
        this._thisObject = _thisObject;
    }

    /**
     * Return an absolute value
     * @param {number} n The signed value to get an ansolute value for.
     * @returns {number} The unsigned absolute value.
     */
    abs(n) {
        return Math.abs(n);
    }

    /**
     * Bind an action to the current player.
     * @param {string} verb The command to bind.
     * @param {any} callback
     */
    addAction(verb, callback) {
        var prevObject = this.previousObject(),
            thisObject = this.thisObject();
        if (prevObject) {
            prevObject.bindAction(verb, thisObject, callback);
        }
    }

    adminp(target) {
        return MUDData.MasterObject.inGroup(target, 'admin');
    }

    archp(target) {
        return MUDData.MasterObject.inGroup(target, 'arch', 'admin');
    }

    arrayToSentence(list, useOr, consolidate, useNumbers) {
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
    }

    /**
     * Not sure what MudOS does with this, but okay...
     * @param {any} arr
     */
    assembleClass(arr) {
        var s = '(function() { return function(o) {\n';
        if (Array.isArray(arr)) {
            arr.forEach(el => s += `  this.${el} ` + '= typeof o === \'object\' ? o.' + el + ' : undefined;\n');
            s += '};})()';
            return eval(s);
        }
        else throw new Error(`Bad argument 1 to assemble_class(); Expected array got ${typeof arr}`);
    }

    authorStats(name) {
        return DomainStatsContainer.getAuthor(name);
    }

    /**
     * Validate a password.
     * @param {string} plain The plain text entered as a password.
     * @param {string} crypto The encrypted password to check against.
     * @param {function=} callback Optional callback if operation is async.
     * @returns {boolean} True if the password matches false if not.
     */
    checkPassword(plain, crypto, callback) {
        return MUDData.Config.mud.passwordPolicy.checkPassword(plain, crypto, callback);
    }

    cloneObject(file) {
        if (arguments.length === 0)
            throw new Error('Bad call to cloneObject; Expected string got null');
        let args = [].slice.call(arguments),
            filename = this.resolvePath(args[0], this.directory + '/');

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
    }

    consolidateArray (arr) {
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
    }

    /**
     * Create an encrypted password.
     * @param {string} plainText The plain text to be encrypted.
     * @param {function=} callback An optional callback if the operation is async.
     * @returns {string|void} Returns void if async or an encrypted string.
     */
    createPassword(plainText, callback) {
        MUDData.Config.mud.passwordPolicy.hashPasword(plainText, callback);
    }

    /**
     * Return the complete inventory of an object, including contained objects.
     * TODO: Make Async
     * @param {MUDObject} target
     * @param {any} callback
     */
    deepInventory(target, callback) {
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
            return _async ? callback(result) : result;

        }
        return false;
    }

    domainStats(domain) {
        return DomainStatsContainer.getDomain(domain);
    }

    /**
     * Switch an interactive object's body instance.
     * @param {MUDObject} oldBody
     * @param {MUDObject} newBody
     * @param {any} client
     * @param {any} callback
     */
    exec(oldBody, newBody, client, callback) {
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
    }

    /**
     * Check to see if a specific Mudlib feature is enabled or not.
     * @param {string} feature The name of the feature to check.
     * @returns {boolean} True if the feature is enabled or false if it does not exist or is disabled.
     */
    featureEnabled(feature) {
        let result = MUDData.Config.readValue(`mud.features.${feature}`, false);
        return result === true;
    }

    /**
     * Locate an object within the game.
     * @param {string} filename
     */
    findObject(filename) {
        var parts = filename.split('#', 2),
            basename = parts[0],
            instanceId = parts.length === 1 ? 0 : parseInt(parts[1]),
            module = MUDData.ModuleCache.get(basename);

        if (module) {
            return module.wrappers[instanceId] || false;
        }
        return false;
    }

    /**
     * Find a player in the game.
     * @param {string} name The name of the character to find.
     * @param {bool=} partial If true then partial name matches are permitted (default: false)
     */
    findPlayer(name, partial) {
        if (typeof name !== 'string')
            throw new Error('Bad argument 1 to findPlayer; Expects string got {0}'.fs(typeof name));

        let search = name.toLowerCase().replace(/[^a-zA-Z0-9]+/g, ''),
            len = search.length,
            matches = MUDData.Players.filter(p => p().getName() === search || (partial && p().getName().slice(0, len) === search));

        return matches.length === 1 ? matches[0] : false;
    }

    /**
     * Return filenames matching the specified file pattern.
     * @param {string} expr The pattern to match.
     * @param {number=} flags Additional detail flags.
     * @param {function=} cb An optional callback for async operation.
     */
    getDir(expr, flags, cb) {
        if (typeof flags === 'function') (cb = flags), (flags = 0);
        return this.resolvePath(expr, (fullpath) => {
            if (MUDData.MasterObject.validRead(this, fullpath)) {
                return MUDData.MasterEFUNS.getDir(
                    MUDData.MasterEFUNS.mudPathToAbsolute(fullpath), flags,
                    MUDExecutionContext.awaiter(cb));
            }
            throw new Error('Permission denied: ' + expr);
        });
    }

    /**
     * Converts a numeric storage size into a human-friendly form.
     * @param {number} n A number of bytes
     * @returns {string} A human-friendly string.
     */
    getMemSizeString(n) {
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
    }

    /**
     * Compute the possible file locations of one or more include files.
     * @param {...string[]} files One or more files to locate.
     */
    includePath (...files) {
        let includePath = MUDData.MasterObject.includePath, result = [];

        files.forEach(fn => {
            includePath.forEach(dir => {
                var path = this.resolvePath(fn, dir);
                if (!path.endsWith('.js')) path += '.js';
                result.push(path);
            });
        });
        return files.length === 0 ? MUDData.MasterObject.includePath : result;
    }

    /**
     * Determines whether the specified path expression is a directory.
     * @param {string} dirpath The path expression to check.
     * @param {function=} callback Optional callback for async operation.
     * @returns {boolean} True if the path resolves to a directory.
     */
    isDirectory  (dirpath, callback) {
        if (MUDData.MasterObject.validRead(this, dirpath)) {
            return MUDData.MasterEFUNS.isDirectory(MUDData.MasterEFUNS.mudPathToAbsolute(dirpath), callback);
        }
        throw new Error('Permission denied: ' + dirpath);
    }

    /**
     * Checks to see if the value is a class.
     * @param {any} o The value to check.
     * @returns {boolean} True if the value is a class reference.
     */
    isClass (o) {
        return o && /\s*class /.test(o.toString());
    }

    /**
     * Determine whether the value is a clone or not.
     * @param {any} o The value to check.
     * @returns {boolean} True if the value is a clone of a MUD object.
     */
    isClone(o) {
        return unwrap(o, (ob) => ob.instanceId > 0);
    }

    /**
     * Indents a string by prefixing each line with whitespace.
     * @param {string} str The string to indent.
     * @param {number} count The number of patterns to insert (default: 1)
     * @param {any} pattern The pattern to insert (default: tab);
     * @returns {string} The indented string.
     */
    indent(str, count, pattern) {
        return str.split('\n')
            .map(s => Array(count || 1).join(pattern || '\t') + s)
            .join('\n');
    }

    /**
     * Determines whether the path expression represents a normal file.
     * @param {string} filepath The file expression to check.
     * @param {function=} cb An optional callback for async operation.
     */
    isFile (filepath, cb) {
        if (MUDData.MasterObject.validRead(this, filepath)) {
            return MUDData.MasterEFUNS.isFile(MUDData.MasterEFUNS.mudPathToAbsolute(filepath), cb);
        }
        throw new ErrorTypes.SecurityError();
    }

    /**
     * Determines whether the target value is a living object.
     * @param {any} target The value to check.
     * @returns {boolean} True if the object is alive or false if not.
     */
    isLiving(target) {
        return unwrap(target, (ob) => ob.isLiving());
    }

    /**
     * Attempts to find the specified object.  If not found then the object is compiled and returned.
     * @param {string} path The filename of the object to try and load.
     * @param {any} args If the object is not found then these arguments are passed to the constructor.
     */
    loadObject(path, args) {
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
    }

    /**
     * Send a message to one or more recipients.
     * @param {string} messageType
     * @param {string|MUDHtmlComponent|number|function} expr
     * @param {...MUDObject[]} audience
     */
    message(messageType, expr, ...audience) {
        if (expr && MUDData.ThisPlayer) {
            if (typeof expr !== 'string') {
                if (expr instanceof MUDHtmlComponent)
                    expr = expr.render();
                else if (typeof expr === 'number')
                    expr = expr.toString();
                else if (typeof expr !== 'function')
                    throw new Error(`Bad argument 2 to message; Expected string, number, or MUDHtmlComponent but received ${typeof expr}`);
            }
            if (typeof expr === 'function') {
                audience.forEach(a => {
                    if (Array.isArray(a))
                        a.forEach((player) => this.message(messageType, expr, player));
                    else unwrap(a, (player) => player.receive_message(messageType, expr(player)));
                });
            }
            else {
                audience.forEach(a => {
                    if (Array.isArray(a)) {
                        a.forEach((player) => this.message(messageType, expr, player));
                    }
                    else unwrap(a, a => a.receive_message(messageType, expr));
                });
            }
        }
    }

    /**
     * Create a directory in the MUD filesystem.
     * @param {string} path The file expression to turn into a directory.
     * @param {function=} callback An optional callback for async mode.
     * @returns {boolean} True if the directory was created (or already exists)
     */
    mkdir(path, callback) {
        var filename = this.resolvePath(path);
        if (MUDData.MasterObject.validWrite(this, filename)) {
            var absPath = MUDData.MasterEFUNS.mudPathToAbsolute(filename);
            return MUDData.MasterEFUNS.mkdir(absPath, callback);
        }
        throw new ErrorTypes.SecurityError();
    }

    mudInfo () {
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
            mudlibBaseVersion: MUDData.Config.mudlib.getVersion(),
            mudlibVersion: 'Emerald MUD 2.0',
            mudMemoryTotal: this.getMemSizeString(process.memoryUsage().heapTotal),
            mudMemoryUsed: this.getMemSizeString(process.memoryUsage().heapUsed),
            name: MUDData.MasterObject.mudName,
            osbuild: os.type() + ' ' + os.release(),
            serverAddress: MUDData.MasterObject.serverAddress,
            systemMemoryUsed: this.getMemSizeString(os.totalmem() - os.freemem()),
            systemMemoryPercentUsed: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100.0,
            systemMemoryTotal: this.getMemSizeString(os.totalmem()),
            uptime: MUDData.MasterObject.uptime()
        };
    }

    /**
     * Returns the MUD's name
     * @returns {string} The MUD name.
     */
    mudName() {
        return MUDData.Config.mud.name;
    }

    /**
     * Returns a normalized version of a character name.
     * @param {string} name The name to normalize e.g. Bob the Builder
     * @returns {string} The normalized version of the name e.g. 'bobthebuilder'
     */
    normalizeName(name) {
        if (typeof name !== 'string')
            throw new Error('Bad argument 1 to normalizeName; Expected string got {0}'.fs(typeof name));
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    }

    /**
     * Determines whether a value is a player or not.
     * @param {any} target The value to check.
     * @returns {boolean} True if the value is a player or false.
     */
    playerp(target) {
        return unwrap(target, (player) => player.isPlayer());
    }

    /**
     * Returns players in the game.  
     * @param {boolean=} showAll If optional flag is provided then link-dead players are also shown.
     * @returns {MUDObject[]} Player objects currently in the game.
     */
    players(showAll) {
        return MUDData.Players.map(p => unwrap(p)).filter((player) => {
            if (!player.connected && !showAll)
                return false;
            return true;
        });
    }

    /**
     * Returns the pluralized version of a string.
     * @param {string} what The string to pluralize. e.g. "Sword of Truth"
     * @returns {string} The pluralized version of the string.  e.g. "Swords of Truth"
     */
    pluralize(what) {
        return MUDData.MasterEFUNS.pluralize(what);
    }

    /**
     * Attempt to read a value from the MUD's config file.
     * @param {string} key A delimited key like mud.name.
     * @param {any} defaultValue A default value if one was not specified in the config.
     * @returns {any} A value from the config if permitted by the master object.
     */
    readConfig(key, defaultValue) {
        if (MUDData.MasterObject.validReadConfig(this.thisObject(), key))
            return MUDData.Config.readValue(key, defaultValue);
        return false;
    }

    /**
     * Attempt to read a plain file.
     * @param {string} filename The name of the file to read.
     * @param {function=} callback An optional callback for an async read.
     * @returns {string|void} Reads the file contents if read synchronously.
     */
    readFile(filename, callback) {
        if (MUDData.MasterObject.validRead(this, filename)) {
            let result = MUDData.MasterEFUNS.readFile(
                MUDData.MasterEFUNS.mudPathToAbsolute(this.resolvePath(filename)),
                MUDExecutionContext.awaiter(callback));
            return result ? MUDData.StripBOM(result) : undefined;
        }
        throw new Error('Permission denied: ' + filename);
    }

    /**
     * 
     * @param {string} filename
     * @param {function=} callback
     */
    readJsonFile(filename, callback) {
        if (typeof callback === 'function') {
            return this.readFile(this.resolvePath(filename), (content) => {
                var result = JSON.parse(content);
                callback(result, false);
            });
        }
        else {
            return JSON.parse(this.readFile(this.resolvePath(filename)));
        }
    }

    reloadObject(path) {
        var filename = this.resolvePath(path);
        if (MUDData.MasterObject.validRead(this, filename)) {
            var result = MUDData.Compiler(filename, true);
            return result === false ? false : true;
        }
        throw new ErrorTypes.SecurityError();
    }

    /**
     * Attempt to convert a partial MUD path into a fully-qualified MUD path.
     * @param {string} expr
     * @param {string} expr2
     * @param {any} callback
     */
    resolvePath(expr, expr2, callback) {
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
    }

    restoreObject(path) {
        let result = false;
        try {
            let prev = this.previousObject();
            if (prev) {
                let data = this.readJsonFile(path);
                if (data) {
                    let $storage = MUDData.Storage.get(prev);
                    $storage && $storage.restore(data);
                    result = true;
                }
            }
        }
        finally {
            return result;
        }
    }

    rm(path, callback) {
        var filename = this.resolvePath(path);
        if (MUDData.MasterObject.validWrite(this, filename)) {
            var absPath = MUDData.MasterEFUNS.mudPathToAbsolute(filename);
            return MUDData.MasterEFUNS.rm(absPath);
        }
        throw new ErrorTypes.SecurityError();
    }

    rmdir(path, callback) {
        var filename = this.resolvePath(path);
        if (MUDData.MasterObject.validWrite(this, filename)) {
            var absPath = MUDData.MasterEFUNS.mudPathToAbsolute(filename);
            return MUDData.MasterEFUNS.rmdir(absPath);
        }
        throw new ErrorTypes.SecurityError();
    }

    saveObject(path) {
        try {
            let prev = this.previousObject();

            if (prev) {
                this.writeJsonFile(path, prev.serializeObject());
                return true;
            }
        }
        catch (err) {

        }
        return false;
    }

    /**
     * Set the reset interval for a particular object.
     * @param {MUDObject} target
     * @param {number=} interval
     */
    setResetInterval(target, interval) {
        unwrap(target, (ob) => {
            if (!interval) {
                interval = MUDConfig.mudlib.objectResetInterval;
                interval = (interval / 2) + Math.random(interval / 2);
            }
            MUDData.MasterObject.registerResetTime(ob, new Date().getTime() + interval);
        });
    }

    shutdown(errCode, reason) {
        if (MUDData.MasterObject.validShutdown(this)) {
            process.exit(errCode || 0);
        }
    }

    sprintf(...args) {
        return sprintf.apply(sprintf, args);
    }

    /**
     * Returns the upper-most object on the stack.
     * @returns {MUDObject|false} The last object to interact with the MUD or false if none.
     */
    thisObject() {
        var prev = this.previousObject(-1);
        return prev[0] || false;
    }

    /**
     * Perform an operation using only the current object's permissions.
     * @param {function} callback The code to execute in unguarded mode.
     * @returns {any} The result of the unguarded call.
     */
    unguarded(callback) {
        var result = false,
            context = new MUDExecutionContext();
        try {
            MUDData.ObjectStack = MUDData.ObjectStack.slice(0, 1);
            result = callback();
        }
        catch (err) {
            throw err;
        }
        finally {
            context.restore();
        }
        return typeof result === 'undefined' ? this : result;
    }

    userp(target) {
        return unwrap(target, (player) => player.isPlayer());
    }

    /**
     * Checks to see if a given password complies with the MUD password policy.
     * @param {string} str A plain text password.
     * @returns {boolean} True if the password complies with the policy or false if too weak.
     */
    validPassword(str) {
        return MUDData.Config.mud.passwordPolicy.validPassword(str);
    }

    /**
     * Determine if the given object is a wizard or not.
     * @param {any} target
     */
    wizardp(target) {
        return MUDData.MasterObject.inGroup(target, 'admin', 'arch', 'wizard');
    }

    /**
     * Write a message to the current player's screen.
     * @param {any} expr
     */
    write(expr) {
        this.message('write', expr, MUDData.ThisPlayer);
        return true;
    }
    /**
     * Write text to file.
     * @param {string} filename The file to write to.
     * @param {string} content The content to write.
     * @param {function=} callback Optional callback for async mode.
     * @param {boolean} overwrite A flag indicating the file should be overwritten.
     */
    writeFile(filename, content, callback, overwrite) {
        var _async = typeof callback === 'function',
            _filename = this.resolvePath(filename),
            _absfile = MUDData.MasterEFUNS.mudPathToAbsolute(_filename);

        if (typeof content === 'object') {
            content = JSON.stringify(content);
            overwrite = true;
        }
        else if (typeof content === 'function') {
            content = content();
        }

        if (MUDData.MasterObject.validWrite(this, _filename)) {
            return MUDData.MasterEFUNS.writeFile(_absfile, content,
                MUDExecutionContext.awaiter(callback),
                overwrite);
        }
        throw new Error('Permission denied: ' + _filename);
    }

    writeJsonFile(filename, data, callback, replacer) {
        return this.writeFile(filename, JSON.stringify(data, replacer, 2), callback, true);
    }
}

Object.defineProperties(EFUNProxy.prototype, {
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
    hasBrowser: {
        value: function (target) {
            var o = unwrap(target);
            return (typeof o === 'object') &&
                (typeof o.client === 'object') &&
                (o.client.isBrowser === true);
        }
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
                    console.log('previousObject() stack:');
                    stack().forEach((cs, i) => {
                        let fn = cs.getFileName() || '[no file]',
                            func = cs.getFunctionName();

                        if (typeof fn === 'string' && !fn.startsWith(MUDData.DriverPath)) {
                            let fileParts = fn.split('#');
                            let module = MUDData.ModuleCache.get(fileParts[0]),
                                instanceId = fileParts.length === 1 ? 0 : parseInt(fileParts[1]);
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

