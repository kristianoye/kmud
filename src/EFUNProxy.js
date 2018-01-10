/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

/// <reference path="dts/GameServer.d.ts"/>

const
    stack = require('callsite'),
    async = require('async'),
    path = require('path'),
    os = require('os'),
    sprintf = require('sprintf').sprintf,
    MUDConfig = require('./MUDConfig'),
    { SecurityError } = require('./ErrorTypes'),
    MUDExecutionContext = require('./MUDExcecutionContext'),
    util = require('util'),
    fs = require('fs'),
    vm = require('vm');

const
    KiloByte = 1024,
    MegaByte = KiloByte * 1000,
    GigaByte = MegaByte * 1000,
    TeraByte = GigaByte * 1000,
    _unguarded = '_unguarded';

const
    PLURAL_SUFFIX = 1,
    PLURAL_SAME = 2,
    PLURAL_CHOP = 2;

var
    MUDStorage = require('./MUDStorage').MUDStorageContainer,
    EFUNS = require('./EFUNS'),
    SaveExtension = '.json',
    { MUDHtmlComponent } = require('./MUDHtml');

class EFUNProxy {
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
        return driver.inGroup(target, 'admin');
    }

    archp(target) {
        return driver.inGroup(target, 'arch', 'admin');
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
            list = Object.mapEach(uniq, (k, v) => 
                `${(useNumbers ? v.toString() : this.cardinal(v))} ${(v > 1 ? this.pluralize(k) : k)}`);
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

    /**
     * Validate a password.
     * @param {string} plain The plain text entered as a password.
     * @param {string} crypto The encrypted password to check against.
     * @param {function=} callback Optional callback if operation is async.
     * @returns {boolean} True if the password matches false if not.
     */
    checkPassword(plain, crypto, callback) {
        return driver.config.mud.passwordPolicy.checkPassword(plain, crypto, callback);
    }

    clientCaps(target) {
        let result = unwrap(target, (ob) => {
            let $storage = driver.storage.get(ob);

            if ($storage) {
                let caps = $storage.getProtected('$clientCaps');
                return caps.queryCaps();
            }
        });

        if (result) return result;

        return {
            clientHeight: 24,
            clientWidth: 80,
            colorEnabled: false,
            htmlEnabled: false,
            soundEnabled: false,
            terminalType: 'ascii',
            videoEnabled: false
        };
    }

    cloneObject(file) {
        if (arguments.length === 0)
            throw new Error('Bad call to cloneObject; Expected string got null');
        let args = [].slice.call(arguments),
            filename = this.resolvePath(args[0], this.directory + '/');

        if (driver.validRead(this, filename)) {
            var module = driver.cache.get(filename);
            if (!module || !module.loaded) {
                module = driver.compiler.compileObject(filename);
            }
            if (module) {
                if (module.singleton)
                    throw new SecurityError(filename + ' is a singleton and cannot be cloned');
                return module.createInstance(-1, false, args[1]);
            }
            return false;
        }
        throw new SecurityError();
    }

    /**
     * 
     * @param {string[]} list
     * @param {number} width
     */
    columnText(list, width) {
        let rows = [],
            row = [],
            longest = 0,
            colCount = 0,
            colWidth = 0;

        width = (width || this.clientCaps(driver.thisPlayer).clientWidth || 80) -2;

        list.forEach(i => { let n = i.length; longest = n > longest ? n : longest; });
        colWidth = longest + 2;
        colCount = Math.floor(width / colWidth);
        list.forEach((item, index) => {
            let s = item + Array(colWidth - item.length).join(' ');
            row.push(s);
            if ((index + 1) % colCount === 0) {
                rows.push(row.join('').trim());
                row = [];
            }
        });
        if (row.length > 0) rows.push(row.join(''));
        return rows.join('\n');
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
     * Force the previous object to perform an in-game object.
     */
    command(input) {
        let _thisObject = this.ThisPlayer || this.thisObject(),
            prevPlayer = driver.thisPlayer;
        if (_thisObject) {
            let $storage = driver.storage.get(_thisObject),
                client = $storage.getProtected('$client'),
                evt = client ? client.createCommandEvent(_thisObject) : false;
            try {
                driver.thisPlayer = _thisObject;
                if (!evt) {
                    let words = input.trim().split(/\s+/g),
                        verb = words.shift();

                    evt = {
                        verb: verb.trim(),
                        args: words,
                        callback: function () { },
                        client: client || null,
                        error: 'What?',
                        fromHistory: false,
                        input: input.slice(verb.length).trim(),
                        original: input,
                        preferHtml: false,
                        prompt: {
                            type: 'text',
                            text: '> ',
                            recapture: false
                        }
                    };
                }
                $storage.emit('kmud.command', evt);
            }
            finally {
                driver.thisPlayer = prevPlayer;
            }
        }
    }

    /**
     * Create an encrypted password.
     * @param {string} plainText The plain text to be encrypted.
     * @param {function=} callback An optional callback if the operation is async.
     * @returns {string|void} Returns void if async or an encrypted string.
     */
    createPassword(plainText, callback) {
        return driver.config.mud.passwordPolicy.hashPasword(plainText, callback);
    }

    /**
     * Returns the currently executing verb.
     * @returns {string|false} The current verb or false if none.
     */
    currentVerb() {
        return driver.currentVerb || false;
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
        if (driver.validExec(this, oldBody, newBody, client)) {
            var oldContainer = oldBody ? driver.storage.get(oldBody) : false,
                newContainer = driver.storage.get(newBody),
                client = oldContainer.getProtected('$client'),
                execEvent = {
                    oldBody: oldBody,
                    oldStorage: oldContainer,
                    newBody: newBody,
                    newStorage: newContainer,
                    client: client
                };

            if (oldContainer) oldContainer.emit('kmud.exec', execEvent);
            newContainer
                .setProtected('$client', client)
                .setProtected('$clientCaps', client.caps)
                .emit('kmud.exec', execEvent);
            driver.emit('kmud.exec', execEvent);

            if (!client) client = thisPlayer.client;
            if (typeof client === 'object') {
                if (driver.exec(oldBody, newBody, client)) {
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
     * 
     * @param {string[]} exits
     */
    clientExits(prefix, exits, target) {
        let player = target || driver.thisPlayer;
        if (player) {
            let $storage = MUDStorage.get(player),
                caps = $storage.getClientCaps();
            if (caps) {
                return caps.do('renderRoomExits', prefix, exits);
            }
        }
        return false;
    }

    /**
     * Old school ed() support.
     * @param {string} fileName
     * @param {string|function} writeFunc
     * @param {string|function} exitFunc
     * @param {boolean} restrict
     */
    ed(fileName, writeFunc, exitFunc, restrict) {
        let args = new MUDArgs(arguments),
            file = args.required('string'),
            writeCallback = args.optional('functon|string'),
            exitCallback = args.optional('function|string'),
            restricted = args.optional('boolean', false);
    }

    driverFeature(feature) {
        let result = driver.config.readValue(`driver.featureFlags.${feature}`, false);
        return result === true;
    }

    /**
     * Check to see if a specific Mudlib feature is enabled or not.
     * @param {string} feature The name of the feature to check.
     * @returns {boolean} True if the feature is enabled or false if it does not exist or is disabled.
     */
    featureEnabled(feature) {
        let result = driver.config.readValue(`mud.features.${feature}`, false);
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
            module = driver.cache.get(basename);

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
            throw new Error(`Bad argument 1 to findPlayer; Expects string got ${(typeof name)}`);

        let search = name.toLowerCase().replace(/[^a-zA-Z0-9]+/g, ''),
            len = search.length,
            matches = driver.players.filter(p => p().getName() === search || (partial && p().getName().slice(0, len) === search));

        return matches.length === 1 ? matches[0] : false;
    }

    /**
     * Returns the state of the MUD.
     * @returns {number} The state of the MUD.
     */
    gameState() {
        return driver.gameState;
    }

    /**
     * Return filenames matching the specified file pattern.
     * @param {string} expr The pattern to match.
     * @param {number=} flags Additional detail flags.
     * @param {function=} callback An optional callback for async operation.
     */
    getDir(expr, flags, callback) {
        if (typeof flags === 'function') (callback = flags), (flags = 0);
        return driver.fileManager.readDirectory(this, this.resolvePath(expr), flags, callback);
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
        let includePath = driver.includePath.slice(0).concat([this.directory]), result = [];

        files.forEach(fn => {
            includePath.forEach(dir => {
                var path = this.resolvePath(fn, dir);
                if (!path.endsWith('.js')) path += '.js';
                result.push(path);
            });
        });
        return files.length === 0 ? driver.includePath : result;
    }

    /**
     * Determines whether the specified path expression is a directory.
     * @param {string} expr The path expression to check.
     * @param {function(boolean,Error):void} callback Optional callback for async operation.
     * @returns {boolean} True if the path resolves to a directory.
     */
    isDirectory  (expr, callback) {
        let dirPath = this.resolvePath(expr);
        if (typeof flags === 'function') {
            callback = flags;
            flags = 0;
        }
        if (typeof callback === 'function') {
            this.stat(dirPath, flags, (fs, err) => {
                return callback(!err && fs.isDirectory, err);
            });
        }
        let stat = driver.fileManager.stat(this, dirPath, StatFlags.None);
        return stat && stat.isDirectory;
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
     * @param {string} expr The file expression to check.
     * @param {number=} flags Optional flags to request additional details.
     * @param {function(boolean,Error):void} callback An optional callback for async operation.
     */
    isFile(expr, flags, callback) {
        let filePath = this.resolvePath(expr);
        if (typeof flags === 'function') {
            callback = flags;
            flags = 0;
        }
        if (typeof callback === 'function') {
            this.stat(filePath, flags, (fs, err) => {
                return callback(!err && fs.isFile, err);
            });
        }
        let stat = driver.fileManager.stat(this, filePath, flags);
        return stat && stat.isFile;
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
     * @param {string} expr The filename of the object to try and load.
     * @param {any} args If the object is not found then these arguments are passed to the constructor.
     * @param {function=} callback The optional callback if loading asyncronously.
     */
    loadObject(expr, args, callback) {
        let [filePart, instanceId] = expr.split('#', 2);
        let result = driver.fileManager.loadObject(this, expr, args, callback);

        var filename = this.resolvePath(expr);
        if (driver.validRead(this, filename)) {
            var module = driver.cache.get(filename);
            if (module && module.loaded) {
                if (module.instances[0])
                    return module.getWrapper(0);
                else
                    return module.createInstance(0, false, args);
            }
            else {
                module = driver.compiler.compileObject(filename, false, undefined, args);
                return module ? module.getWrapper(0) : false;
            }
        }
        throw new SecurityError();
    }

    /**
     * Send a message to one or more recipients.
     * @param {string} messageType
     * @param {string|MUDHtmlComponent|number|function} expr
     * @param {MUDObject[]} audience
     * @param {MUDObject[]} excluded
     */
    message(messageType, expr, audience, excluded) {
        if (expr) {
            if (!excluded) excluded = [];
            if (!Array.isArray(excluded)) excluded = [excluded];
            if (!Array.isArray(audience)) audience = [audience];
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
                        a.forEach((player) => this.message(messageType, expr, player, excluded));
                    else unwrap(a, (player) => {
                        if (excluded.indexOf(player) === -1)
                            player.receive_message(messageType, expr(player));
                    });
                });
            }
            else {
                audience.forEach(a => {
                    if (Array.isArray(a)) {
                        a.forEach((player) => this.message(messageType, expr, player, excluded));
                    }
                    else unwrap(a, (player) => {
                        if (excluded.indexOf(player) === -1)
                            player.receive_message(messageType, expr);
                    });
                });
            }
        }
    }

    /**
     * Create a directory in the MUD filesystem.
     * @param {string} expr The file expression to turn into a directory.
     * @param {MkDirOptions=} opts Optional flags to pass to createDirectory.
     * @param {function=} callback An optional callback for async mode.
     * @returns {boolean} True if the directory was created (or already exists)
     */
    mkdir(expr, opts, callback) {
        if (typeof opts === 'function') {
            callback = opts;
            opts = 0;
        }
        else if (typeof opts === 'number') {
            opts = { opts };
        }
        return driver.fileManager.createDirectory(this, expr, opts || {}, callback);
    }

    mudInfo() {
        let config = driver.config;
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
            mudAdmin: config.mud.getAdminName(true),
            mudAdminEmail: config.mud.getAdminEmail(true),
            mudlibName: 'KMUD',
            mudlibBaseVersion: config.mudlib.getVersion(),
            mudlibVersion: 'Emerald MUD 2.0',
            mudMemoryTotal: this.getMemSizeString(process.memoryUsage().heapTotal),
            mudMemoryUsed: this.getMemSizeString(process.memoryUsage().heapUsed),
            name: driver.mudName,
            osbuild: os.type() + ' ' + os.release(),
            serverAddress: driver.serverAddress,
            systemMemoryUsed: this.getMemSizeString(os.totalmem() - os.freemem()),
            systemMemoryPercentUsed: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100.0,
            systemMemoryTotal: this.getMemSizeString(os.totalmem()),
            uptime: driver.uptime()
        };
    }

    /**
     * Returns the MUD's name
     * @returns {string} The MUD name.
     */
    mudName() {
        return driver.config.mud.name;
    }

    /**
     * Returns a normalized version of a character name.
     * @param {string} name The name to normalize e.g. Bob the Builder
     * @returns {string} The normalized version of the name e.g. 'bobthebuilder'
     */
    normalizeName(name) {
        if (typeof name !== 'string')
            throw new Error(`Bad argument 1 to normalizeName; Expected string got ${(typeof name)}`);
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
        return driver.players.map(p => unwrap(p)).filter(player => {
            return player.connected || showAll;
        });
    }

    /**
     * Based on MudOS pluralize() + a few bug fixes.  Converts a string to the pluralized version.
     * Examples: child -> children, fox -> foxes.
     *
     * @param {string} what The string to pluralize.
     * @returns {string} A pluralized form of the string.
     */
    pluralize(what) {
        var o = unwrap(what),
            result;

        if (o) {
            var _p = _o.getPluralizedName();
            if (_p) return _p;
            return this.pluralize(o.getPrimaryName());
        }
        if (typeof what !== 'string')
            throw new Error(`Bad argument 1 to pluralize(); Expected string|object got ${typeof what}`);

        var m = / of /i.exec(what);
        if (m && m.index > 0) {
            return this.pluralize(what.slice(0, m.index)) + what.slice(m.index);
        }
        if (what.match(/a /i))
            return this.pluralize(what.slice(2));
        else if (what.match(/an /i))
            return this.pluralize(what.slice(3));

        if (what.indexOf(' ') > -1) {
            var lastIndex = what.lastIndexOf(' ');
            return what.slice(0, lastIndex + 1) + this.pluralize(what.slice(lastIndex + 1));
        }

        var found = 0,
            suffix = 's',
            toUpper = what.toUpperCase() === what,
            whatLC = what.toLowerCase();

        switch (what.charAt(0).toLowerCase()) {
            case 'a':
                if (whatLC === 'are') {
                    found = PLURAL_CHOP + 3;
                    suffix = "is";
                }
                break;

            case 'b':
                if (whatLC === 'bus') {
                    found = PLURAL_SUFFIX;
                    suffix = "es";
                }
                else if (what.match(/^bonus/i)) {
                    found = PLURAL_SUFFIX;
                    suffix = "es";
                }
                break;

            case 'c':
                if (whatLC === 'child') {
                    found = PLURAL_SUFFIX;
                    suffix = "ren";
                }
                else if (what.match(/^cliff/i)) {
                    found = PLURAL_SUFFIX;
                    suffix = "s";
                }
                break;

            case 'd':
                if (whatLC === 'datum') {
                    found = PLURAL_CHOP + 2;
                    suffix = 'a';
                }
                else if (whatLC === 'die') {
                    found = PLURAL_CHOP + 1;
                    suffix = 'ce';
                }
                else if (whatLC === 'deer') {
                    found = PLURAL_SAME;
                }
                else if (whatLC === 'do') {
                    found = PLURAL_SUFFIX;
                    suffix = 'es';
                }
                else if (whatLC === 'dynamo') {
                    found = PLURAL_SUFFIX;
                }
                break;

            case 'f':
                if (whatLC === 'foot') {
                    found = PLURAL_CHOP + 3;
                    suffix = 'feet';
                }
                else if (whatLC === 'fish') {
                    found = PLURAL_SAME;
                }
                else if (whatLC === 'forum') {
                    found = PLURAL_CHOP + 2;
                    suffix = 'a';
                }
                else if (whatLC === 'fife') {
                    found = PLURAL_SUFFIX;
                }

            case 'g':
                switch (whatLC) {
                    case 'gum':
                    case 'giraffe':
                        found = PLURAL_SUFFIX;
                        break;
                    case 'glasses':
                        found = PLURAL_SAME;
                        break;
                    case 'goose':
                        found = PLURAL_CHOP + 4;
                        suffix = 'eese';
                        break;
                    case 'go':
                        found = PLURAL_SUFFIX;
                        suffix = 'es';
                        break;
                }
                break;

            case 'h':
                if (whatLC === 'human')
                    found = PLURAL_SUFFIX;
                else if (whatLC === 'have')
                    found = PLURAL_CHOP + 2;
                break;

            case 'i':
                if (whatLC === 'index') {
                    found = PLURAL_CHOP + 2;
                    suffix = 'ices';
                }
                break;

            case 'l':
                if (whatLC === 'louse') {
                    found = PLURAL_CHOP + 4;
                    suffix = 'ice';
                }
                else if (whatLC === 'lotus')
                    found = PLURAL_SUFFIX;
                break;

            case 'm':
                switch (whatLC) {
                    case 'mackerel':
                    case 'moose':
                        found = PLURAL_SAME;
                        break;
                    case 'mouse':
                        found = PLURAL_CHOP + 4;
                        suffix = 'ice';
                        break;
                    case 'matrix':
                        found = PLURAL_CHOP + 1;
                        suffix = 'ces';
                        break;
                    case 'mech':
                        found = PLURAL_SUFFIX;
                        break;
                }
                break;

            case 'o':
                if (whatLC === 'ox') {
                    found = PLURAL_SUFFIX;
                    suffix = 'en';
                }
                break;

            case 'p':
                if (whatLC === 'pants')
                    found = PLURAL_SAME;
                break;

            case 'q':
                if (whatLC === 'quaff')
                    found = PLURAL_SUFFIX;
                break;

            case 'r':
                switch (whatLC) {
                    case 'remains':
                        found = PLURAL_SAME;
                        break;
                    case 'roof':
                        found = PLURAL_SUFFIX;
                        break;
                }
                break;

            case 's':
                switch (whatLC) {
                    case 'sniff':
                    case 'safe':
                    case 'shaman':
                        found = PLURAL_SUFFIX;
                        break;
                    case 'sheep':
                        found = PLURAL_SAME;
                        break;
                    case 'sphinx':
                        found = PLURAL_CHOP + 1;
                        suffix = 'ges';
                        break;
                    case 'staff':
                        found = PLURAL_CHOP + 2;
                        suffix = 'ves';
                }
                break;

            case 't':
                switch (whatLC) {
                    case 'thief':
                        found = PLURAL_CHOP + 1;
                        suffix = 'ves';
                        break;
                    case 'tooth':
                        found = PLURAL_CHOP + 4;
                        suffix = 'eeth';
                        break;
                    case 'talisman':
                        found = PLURAL_SUFFIX;
                        break;
                }
                break;

            case 'v':
                switch (whatLC) {
                    case 'vax':
                        found = PLURAL_SUFFIX;
                        suffix = 'en';
                        break;
                    case 'virus':
                        found = PLURAL_SUFFIX;
                        suffix = 'es';
                        break;
                }
                break;

            case 'w':
                switch (whatLC) {
                    case 'was':
                        found = PLURAL_CHOP + 2;
                        suffix = 'ere';
                        break;
                }
                break;
        }

        if (!found) {
            function getEnd(n) {
                var a = [].slice.call(arguments, 1),
                    r = whatLC.slice(whatLC.length - n);
                if (a.length) return a.filter(_ => _ === r).length > 0;
                return r;
            }
            switch (getEnd(1)) {
                case 'e':
                    if (whatLC.endsWith('fe')) {
                        found = PLURAL_CHOP + 2;
                        suffix = 'ves';
                    }
                    break;
                case 'f':
                    if (whatLC.endsWith('ef'))
                        break;
                    else {
                        found = PLURAL_CHOP + 1;
                        if (whatLC.endsWith('ff')) suffix = 'ves';
                    }
                    break;
                case 'h':
                    if (whatLC.endsWith('sh') || whatLC.endsWith('ch'))
                        suffix = 'es';
                    break;
                case 'm':
                    if (whatLC.endsWith('mu')) {
                        found = PLURAL_CHOP + 2;
                        suffix = 'a';
                    }
                    break;
                case 'n':
                    if (whatLC.endsWith('man')) {
                        found = PLURAL_CHOP + 3;
                        suffix = 'man';
                    }
                    break;
                case 'o':
                    if (whatLC.endsWith('oo')) {
                        found = PLURAL_CHOP + 2;
                        suffix = 'es';
                    }
                    break;
                case 's':
                    if (whatLC.endsWith('is')) {
                        found = PLURAL_CHOP + 2;
                        suffix = 'es';
                    }
                    else if (whatLC.endsWith('us')) {
                        found = PLURAL_CHOP + 2;
                        suffix = 'i';
                    }
                    else if (whatLC.endsWith('as') || whatLC.endsWith('es') || whatLC.endsWith('os'))
                        suffix = 'ses';
                    else
                        suffix = 'es';
                    break;
                case 'x':
                    suffix = 'es';
                    break;
                case 'y':
                    if (!whatLC.match(/[aeiou]y$/i)) {
                        found = PLURAL_CHOP + 1;
                        suffix = 'ies';
                    }
                    break;
                case 'z':
                    if (whatLC.match(/[aeiou]z$/i))
                        suffix = 'zes';
                    else
                        suffix = 'es';
                    break;
            }
        }
        switch (found) {
            case PLURAL_SAME:
                result = what;
                break;

            default:
                what = what.slice(0, what.length - found - PLURAL_CHOP + 1);

            case 0:
            case PLURAL_SUFFIX:
                result = what + suffix;
        }
        return toUpper ? result.toUpperCase() : result;
    }

    /**
     * 
     */
    present() {
        let args = new MUDArgs(arguments),
            objId = '', self = this;

        if (args.optional('string', s => objId = s)) {
            let targets = args.optional('object', o => [o]);
            if (!targets) {
                targets = [this.thisObject()];
                targets.push(targets[0].environment);
            }
            let idList = objId.split(/\s+/g),
                which = parseInt(idList[idList.length - 1]);

            if (isNaN(which)) which = 0;
            else { idList.pop(), which-- };

            for (let i = 0; i < targets.length; i++) {
                let result = unwrap(targets[i], o => {
                    let inv = o.inventory;
                    for (let j = 0; j < inv.length; j++) {
                        if (inv[j].matchesId(idList) && !which--) return inv[j];
                    }
                });
                if (result) return result;
            }
            return false;
        }
        else if(args.nextIs('object')) {
            return args.required('object', target => {
                return unwrap(target, o => {
                    /** @type {MUDObject} */
                    let env = args.optional('object', e => unwrap(e));
                    if (env) {
                        return env.inventory.indexOf(o) > -1 ? o : false;
                    }
                    let prev = self.thisObject();
                    if (prev.inventory.indexOf(o) > -1)
                        return prev;
                    env = prev.environment;
                    if (env) {
                        return env.inventory.indexOf(o) > -1 ? env : false;
                    }
                    return false;
                });
            });
        }
        throw new Error(`Bad argument 1 to present(); Expected string or object but got ${typeof arguments[0]}`);
    }

    /**
     * Attempt to read a value from the MUD's config file.
     * @param {string} key A delimited key like mud.name.
     * @param {any} defaultValue A default value if one was not specified in the config.
     * @returns {any} A value from the config if permitted by the master object.
     */
    readConfig(key, defaultValue) {
        if (driver.validReadConfig(this.thisObject(), key))
            return driver.config.readValue(key, defaultValue);
        return false;
    }

    /**
     * Attempt to read a plain file.
     * @param {string} filename The name of the file to read.
     * @param {function=} callback An optional callback for an async read.
     * @returns {string|void} Reads the file contents if read synchronously.
     */
    readFile(filename, callback) {
        return driver.fileManager.readFile(this, this.resolvePath(filename), callback);
    }

    /**
     * Attempt to read JSON data from a file.
     * @param {string} filename The file to try and read.
     * @param {function=} callback An optional callback for async reads.
     */
    readJsonFile(filename, callback) {
        return driver.fileManager.readJsonFile(this, this.resolvePath(filename), callback);
    }

    reloadObject(path) {
        var filename = this.resolvePath(path);
        if (driver.validRead(this, filename)) {
            var result = driver.compiler.compileObject(filename, true);
            return result === false ? false : true;
        }
        throw new SecurityError();
    }

    /**
     * Attempt to convert a partial MUD path into a fully-qualified MUD path.
     * @param {string} expr
     * @param {string} expr2
     * @param {any} callback
     * @returns {string}
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
                expr = driver.thisPlayer ?
                    '/realms/' + driver.thisPlayer.getName() + expr.slice(1) :
                    self.homeDirectory + expr.slice(1);
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

    /**
     * Restores the state of an object from file.
     * @param {string} path The file to read properties from.
     */
    restoreObject(path) {
        let result = false;
        try {
            let prev = this.thisObject();
            if (prev) {
                if (!path.endsWith(SaveExtension))
                    path += SaveExtension;
                if (this.isFile(path)) {
                    let data = this.readJsonFile(path);
                    if (data) {
                        let $storage = driver.storage.get(prev);
                        $storage && $storage.restore(data);
                        result = true;
                    }
                }
            }
        }
        catch (err) {
            logger.log(err);
        }
        return result;
    }

    /**
     * Removes a file from the filesystem.
     * @param {string} expr The file to unlink from the filesystem.
     * @param {function(boolean,Error):void} callback Optional callback for async mode.
     * @returns {boolean|void}
     */
    rm(expr, callback) {
        return driver.fileManager.deleteFile(expr, callback);
    }

    rmdir(path, callback) {
        return driver.fileManager
        var filename = this.resolvePath(path);
        if (driver.validWrite(this, filename)) {
            var absPath = MUDData.MasterEFUNS.mudPathToAbsolute(filename);
            return MUDData.MasterEFUNS.rmdir(absPath);
        }
        throw new SecurityError();
    }

    /**
     * 
     * @param {string} path The path to save to.
     */
    saveObject(path) {
        try {
            let prev = this.thisObject() || this.previousObject();

            if (prev) {
                if (!path.endsWith(SaveExtension))
                    path += SaveExtension;
                this.writeJsonFile(path, prev.serializeObject());
                return true;
            }
        }
        catch (err) {
            logger.log(err);
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
                interval = driver.config.mudlib.objectResetInterval;
                interval = (interval / 2) + Math.random(interval / 2);
            }
            driver.registerResetTime(ob, new Date().getTime() + interval);
        });
    }

    /**
     * Determines whether the path expression represents a normal file.
     * @param {string} filepath The file expression to check.
     * @param {number=} flags Optional flags to request additional details.
     * @param {function(FileStat,Error):void} callback An optional callback for async operation.
     */
    stat(filepath, flags, callback) {
        return driver.fileManager.statFile(this, filepath, flags, callback);
    }

    shutdown(errCode, reason) {
        if (driver.validShutdown(this)) {
            process.exit(errCode || 0);
        }
    }

    sprintf(...args) {
        return sprintf.apply(sprintf, args);
    }

    stripBOM(content) {
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }
        return content;
    }

    /**
     * Returns the upper-most object on the stack.
     * @returns {MUDObject|false} The last object to interact with the MUD or false if none.
     */
    thisObject() {
        var prev = this.previousObject(-1);
        return prev[0] || false;
    }

    thisPlayer(flag) {
        return flag ? driver.truePlayer || driver.thisPlayer : driver.thisPlayer;
    }

    /**
     * Perform an operation using only the current object's permissions.
     * @param {function} callback The code to execute in unguarded mode.
     * @returns {any} The result of the unguarded call.
     */
    unguarded(callback) {
        var result = false, context = new MUDExecutionContext();
        try {
            result = context.run(callback);
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
        return driver.config.mud.passwordPolicy.validPassword(str);
    }

    /**
     * Determine if the given object is a wizard or not.
     * @param {any} target
     */
    wizardp(target) {
        return unwrap(target, player => {
            return player.filename.startsWith('/v/sys/data/creators/');
        });
    }

    /**
     * Write a message to the current player's screen.
     * @param {any} expr
     */
    write(expr) {
        this.message('write', expr, driver.thisPlayer);
        return true;
    }
    /**
     * Write text to file.
     * @param {string} filename The file to write to.
     * @param {string} content The content to write.
     * @param {function(boolean,Error):void} callback Optional callback for async mode.
     */
    writeFile(filename, content, callback, overwrite) {
        return driver.fileManager.writeFile(this,
            this.resolvePath(filename),
            content,
            callback);
    }

    writeJsonFile(filename, data, callback, replacer) {
        return this.writeFile(filename, JSON.stringify(data, replacer, 2), callback, true);
    }
}

Object.defineProperties(EFUNProxy.prototype, {
    getProxy: {
        value: function (n) {
            var module = driver.cache.get(this.filename);
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
    }
});

/**
 * @param {string} filename File to create proxy for.
 * @param {string} directory The directory portion of the filename.
 */
EFUNProxy.createEfunProxy = function (filename, directory) {
    let wrapper = new EFUNProxy(), perms = [];

    if (driver.masterObject) {
        perms = driver.masterObject.getPermissions(filename);
    }
    else if (!driver.masterObject) {
        if (filename === '/') {
            perms = [driver.config.mudlib.rootUid];
        }
        else {
            perms = [driver.config.mudlib.backboneUid];
        }
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
            directory: {
                value: directory,
                writable: false,
                enumerable: true
            },
            filename: {
                value: fn,
                writable: false,
                enumerable: true
            },
            homeDirectory: {
                value: hd,
                writable: false,
                enumerable: true
            }, // TODO: Make this dynamic call to master object.
            permissions: {
                value: p,
                writable: false,
                enumerable: true
            }
        });
        return Object.seal(w);
    })(wrapper, filename, perms);

};

/**
 * Configure the EFUNProxy based on configuration
 * @param {GameServer} driver
 */
EFUNProxy.configureForRuntime = function (driver) {
    SaveExtension = driver.config.mudlib.defaultSaveExtension;
    driver.efuns = EFUNProxy.createEfunProxy('/', '/');

    if (driver.config.driver.useObjectProxies) {
        EFUNProxy.prototype.previousObject = function (n) {
            throw new Error('Not implemented yet');
        };
    }
    else if (driver.config.driver.objectCreationMethod === 'inline') {
        EFUNProxy.prototype.previousObject = function (n) {
            let objectStack = [], index = (n || 0) + 1;
            stack().forEach((cs, i) => {
                let fn = cs.getFileName();
                if (typeof fn === 'string' && !fn.startsWith(driver.config.driver.driverPath)) {
                    let mudPath = driver.fileManager.toMudPath(fn);
                    let module = driver.cache.get(mudPath);
                    if (module) {
                        let ob = unwrap(module.getWrapper(0));
                        if (objectStack[0] !== ob) objectStack.unshift(ob);
                    }
                }
            });
            return n === -1 ? objectStack.reverse() : objectStack[index];
        };
    }
    else {
        EFUNProxy.prototype.previousObject = function (n) {
            let objectStack = [], index = (n || 0) + 1;
            stack().forEach((cs, i) => {
                let fn = cs.getFileName() || '[no file]',
                    func = cs.getFunctionName();

                if (typeof fn === 'string' && !fn.startsWith(driver.config.driver.driverPath)) {
                    let [modulePath, instanceStr] = fn.split('#', 2);
                    let module = driver.cache.get(modulePath),
                        instanceId = instanceStr ? parseInt(instanceStr) : 0;

                    if (module) {
                        let ob = unwrap(module.getWrapper(instanceId));
                        if (objectStack[0] !== ob) objectStack.unshift(ob);
                    }
                }
            });
            return n === -1 ? objectStack.reverse() : objectStack[index];
        };
    }
};

module.exports = EFUNProxy;

