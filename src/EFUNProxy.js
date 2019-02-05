/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    crypto = require('crypto'),
    fs = require('fs'),
    path = require('path'),
    os = require('os'),
    sprintf = require('sprintf').sprintf;

const
    KiloByte = 1024,
    MegaByte = KiloByte * 1000,
    GigaByte = MegaByte * 1000,
    TeraByte = GigaByte * 1000;

const
    PLURAL_SUFFIX = 1,
    PLURAL_SAME = 2,
    PLURAL_CHOP = 2;

var
    IncludeCache = {},
    MUDStorage = require('./MUDStorage'),
    SaveExtension = '.json',
    { MUDHtmlComponent } = require('./MUDHtml'),
    MUDArgs = require('./MUDArgs');

class EFUNProxy {
    /**
     * Construct a proxy object.
     * @param {string} file The filename of the module holding this instance.
     */
    constructor(file) {
        this.directory = file.slice(0, file.lastIndexOf('/'));
        this.fullPath = file;
        this.fileName = file.slice(file.lastIndexOf('/') + 1);
        this.exported = {};
        this.imported = {};
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
     * @param {function} callback The callback that executes when the action is triggered.
     */
    addAction(verb, callback) {
        var prevObject = this.previousObject(),
            thisObject = this.thisObject();
        if (prevObject) {
            prevObject.bindAction(verb, thisObject, callback);
        }
    }

    /**
     * Add a prompt to the current user's input stack.
     * @param {string|MUDPrompt} opts The prompt options.
     * @param {function(string):void} callback The callback that fires when the user has entered text.
     */
    addPrompt(opts, callback) {
        let ecc = driver.getExecution();
        ecc && ecc.thisClient && ecc.thisClient.addPrompt(opts, callback);
    }

    /**
     * Determine if an object is an admin.
     * @param {MUDObject} target The target object to check.
     * @returns {boolean} True if the target is an administrator.
     */
    adminp(target) {
        return unwrap(target, player => {
            return driver.inGroup(target, 'admin');
        });
    }

    /**
     * Determine if an object is an arch.
     * @param {MUDObject} target The target objecto  check.
     * @returns {boolean} True if the target is an arch.ca
     */
    archp(target) {
        return unwrap(target, player => {
            return driver.inGroup(target, 'admin', 'arch');
        });
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
     * @param {any[]} arr The data to construct.
     * @returns {object} The result of the assemble class
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

    callOut(func, delay, ...args) {
        let mxc = driver.currentContext,
            tob = mxc.thisObject,
            callback = typeof func === 'function' ? func : false;
        if (typeof func === 'string') {
            let method = tob[func];
            if (typeof method === 'function') {
                callback = method.bind(tob, args);
            }
        }
        if (typeof callback !== 'function')
            throw new Error(`Bad argument 1 to function; Expected string or function but got ${typeof func}`);
        let ctx = driver.currentContext.clone();
        let handle = setTimeout(() => {
            try {
                ctx.restore();
                callback();
            }
            finally {
                ctx.release();
            }
        }, delay);
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

    /**
     * Retrieve client capabilities.
     * @param {MUDObject|MUDWrapper} target The object to retrieve caps for.
     * @returns {{ clientHeight: number, clientWidth: number, colorEnabled: boolean, htmlEnabled: boolean, soundEnabled: boolean }} Client capabilities.
     */
    clientCaps(target) {
        let $storage = false;

        if (!target) {
            $storage = driver.currentContext && driver.currentContext.$storage;
        }
        else {
            $storage = unwrap(target, ob => driver.storage.get(ob));
        }
        if ($storage) {
            let caps = $storage.getProtected('$clientCaps');
            if (caps) return caps.queryCaps();
        }
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

    /**
     * Clone an existing in-game object.
     * @param {string} file The object to clone
     * @param {...any} args Constructor args
     * @returns {MUDWrapper} The object if successfully cloned.
     */
    cloneObject(file, ...args) {
        return driver
            .fileManager
            .cloneObjectSync(this, this.resolvePath(file), args);
    }

    /**
     * Render a list of words into columns of the specified width.
     * @param {string|string[]} list A collection of words to format.
     * @param {number} width The maximum column width.
     * @returns {string} A page of columns.
     */
    columnText(list, width) {
        let rows = [],
            row = [],
            longest = 0,
            colCount = 0,
            colWidth = 0;

        if (typeof list === 'string') {
            list = list.split(/\s+/);
        }

        width = (width || this.clientCaps(driver.thisPlayer).clientWidth || 80);

        list.forEach(i => {
            let n = this.stripColor(i).length;
            longest = n > longest ? n : longest;
        });
        colWidth = longest + 2;
        colCount = Math.floor(width / colWidth);
        list.forEach((item, index) => {
            let s = item + Array(colWidth - this.stripColor(item).length).join(' ');
            row.push(s);
            if ((index + 1) % colCount === 0) {
                rows.push(row.join('').trim());
                row = [];
            }
        });
        if (row.length > 0) rows.push(row.join(''));
        return rows.join('\n');
    }

    /**
     * Consolidates a number of short descriptions into an array to be used in a sentence.
     * @param {string[]|MUDObject[]} arr An array of strings and/or MUD Objects.
     * @returns {string[]} A considated array (e.g. ["two swords", "three buckets"])
     */
    consolidateArray (arr) {
        let shorts = {};
        arr.map(s => typeof s === 'string' && s || unwrap(uw => uw.shortDescription) || false)
            .filter(s => s !== false)
            .forEach(s => shorts[s] = (shorts[s] || 0) + 1);
        return Object.keys(shorts).map(s => this.consolidate(shorts[s], s).ucfirst());
    }

    /**
     * Force the previous object to perform an in-game object.
     * @param {string} input The complete command to execute.
     */
    command(input) {
        let ctx = driver.getContext();
        let _thisObject = ctx.thisObject;
        if (_thisObject) {
            let $storage = driver.storage.get(_thisObject),
                client = $storage.getProtected('$client'),
                evt = client ? client.createCommandEvent(_thisObject) : false,
                mxc = ctx.clone(init => {
                    init.note = 'command';
                    init.thisPlayer = _thisObject;
                    init.truePlayer = ctx.truePlayer;
                });
            try {
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
                mxc.input = evt;
                mxc.restore();
                $storage.emit('kmud.command', evt);
            }
            finally {
                mxc.release();
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

    createPasswordAsync(plainText) {
        return driver.config.mud.passwordPolicy.hashPasswordAsync(plainText);
    }

    /**
     * Generate semi-secure, random data.
     * @param {number} bs The size of random bytes to generate.
     * @returns {number} The random data.
     */
    createRandomValue(bs) {
        let result = 0, buffer = crypto.randomBytes(typeof bs === 'number' && bs || 128);
        for (let i = 0, l = buffer.length; i < l; i += 4) {
            result ^= buffer.readInt32LE(i);
        }
        return result & 0xFFFFFFFF;
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
     * @param {MUDObject} target The target to scan
     * @param {function(MUDObject[]):void} callback An optional callback to receive the deep inventory.
     * @returns {MUDObject[]|false} Returns the deep inventory.
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
            if (typeof callback === 'function')
                callback(result);
            return result;

        }
        return false;
    }

    /**
     * Remove an object from the game and (hopefully) allow it to be garbage-
     * collected on the next gc run.  This requires that there are no objects
     * referencing it.
     * @param {MUDObject} ob The object to destruct.
     */
    destruct(ob) {
        unwrap(ob, target => {
            if (driver.validDestruct(this, target)) {
                driver.driverCall('destruct', () => {
                    target.destroy();
                });
            }
        });
    }

    /**
     * Switch an interactive object's body instance.
     * @param {MUDObject} oldBody The body that is being left behind.
     * @param {MUDObject} newBody The body that the user is switching into.
     * @param {function(MUDObject,MUDObject):any} callback The callback to execute when the switch is complete.
     * @returns {boolean} True if the 
     */
    exec(oldBody, newBody, callback) {
        if (driver.validExec(this, oldBody, newBody)) {
            let oldContainer = oldBody ? driver.storage.get(oldBody) : false,
                newContainer = driver.storage.get(newBody),
                client = oldContainer.getProtected('$client'),
                execEvent = {
                    oldBody: oldBody,
                    oldStorage: oldContainer,
                    newBody: newBody,
                    newStorage: newContainer,
                    client: client
                };

            if (oldContainer)
                oldContainer.emit('kmud.exec', execEvent);
            newContainer
                .setClient(client)
                .setProtected('$client', client)
                .setProtected('$clientCaps', client.caps)
                .emit('kmud.exec', execEvent);
            client.handleExec(execEvent);

            if (!client) client = thisPlayer.client;
            if (typeof client === 'object') {
                if (driver.exec(oldBody, newBody, client)) {
                    if (typeof callback === 'function')
                        callback(oldBody, newBody);
                    return true;
                }
            }
            return false;
        }
        throw new Error('Permission denied: ' + expr);
    }

    /**
     * Extends a class using functionality from another type (pseudo-mixin)
     * @param {function} target The target type to extend.
     * @param {string} exp The module that contains the extension
     * 
     */
    addMixin(target, exp) {
        let filename = this.resolvePath(exp, this.directory),
            [moduleName, typeName] = filename.split('$', 2),
            module = driver.compiler.compileObject({
                file: moduleName,
                isMixin: true,
                reload: false,
                relativePath: this.directory
            }),
            mixinType = module && module.getType(typeName || module.name);
        if (!module)
            throw new Error(`Failed to load required module '${filename}'`);
        if (!mixinType)
            throw new Error(`Failed to load required mixin '${typeName || module.name}'`);
        MUDMixin.$extendType(target, mixinType);
    }

    /**
     * Render the exits to the client.  (There must be a better way?)
     * @param {string} prefix Not sure
     * @param {string[]} exits A list of exits available to the client.
     * @param {MUDObject} target The recipient of the exit list.
     * @returns {boolean} True if the exits were sent.
     */
    clientExits(prefix, exits, target) {
        let player = target || driver.thisPlayer;
        if (player) {
            let $storage = driver.storage.get(player),
                caps = $storage.getClientCaps();
            if (caps) {
                return caps.do('renderRoomExits', prefix, exits);
            }
        }
        return false;
    }

    /**
     * Old school ed() support.
     * @param {string} fileName The name of the file to edit.
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

    /**
     * Determine if a particular feature is enabled.
     * @param {string} feature The name of the feature to check.
     * @returns {boolean} Returns true if the specified feature is enabled.
     */
    driverFeature(feature) {
        let result = driver.config.readValue(`driver.featureFlags.${feature}`, false);
        return result === true;
    }

    get exports() {
        let module = driver.cache.get(this.fullPath);
        return module.exports;
    }

    set exports(val) {
        let module = driver.cache.get(this.fullPath);
        return module.addExport(val);
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
     * @param {string} filename The path to search for.
     * @returns {MUDObject|false} Returns the object reference or null.
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
     * @param {bool} partial If true then partial name matches are permitted (default: false)
     * @returns {MUDObject|false} Attempts to return the specified player.
     */
    findPlayer(name, partial) {
        if (typeof name !== 'string')
            throw new Error(`Bad argument 1 to findPlayer; Expects string got ${(typeof name)}`);

        let search = name.toLowerCase().replace(/[^a-zA-Z0-9]+/g, ''),
            len = search.length,
            matches = driver.players
                .filter(p => {
                    let pn = p().getName();
                    return pn === search || partial && pn.slice(0, len) === search;
                });
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
     * @param {number} flags Additional detail flags.
     * @param {function} callback An optional callback for async operation.
     * @returns {void}
     */
    async readDirectory(expr, flags, callback) {
        if (typeof flags === 'function') (callback = flags), (flags = 0);
        if (typeof callback === 'function') {
            return driver.fileManager.readDirectory(this, this.resolvePath(expr), flags, callback);
        }
        else if (callback === true)
            return driver.fileManager.readDirectory(this, this.resolvePath(expr), flags, true);
        else
            return driver.fileManager.readDirectory(this, this.resolvePath(expr), flags);
    }

    /**
     * Read a directory asyncronously.
     * @param {string} expr The path expression to read.
     * @param {number} flags Flags to indicate what type of information is being requested.
     * @param {function(string[],Error):void} callback If specified, use callback-style async instead of returning a Promise
     * @returns {Promise<string[]>|void} Returns a Promise unless 
     */
    readDirectoryAsync(expr, flags, callback) {
        return driver.fileManager.readDirectoryAsync(
            this,
            this.resolvePath(expr, this.directory),
            flags || 0,
            callback || true);
    }

    readDirectorySync(expr, flags) {
        return driver.fileManager.readDirectorySync(
            this,
            this.resolvePath(expr, this.directory),
            flags || 0);
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

    hasBrowser(target) {
        return unwrap(target, o => {
            return this.clientCaps(o).htmlEnabled;
        }) || false;
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
     * Determines whether the specified path expression is a directory.
     * @param {string} expr The path expression to check.
     * @param {function(boolean,Error):void} callback Optional callback for async operation.
     * @returns {boolean} True if the path resolves to a directory.
     */
    isDirectory(expr, callback) {
        return driver.fileManager.isDirectory(this, this.resolvePath(expr), callback);
    }

    /**
     * Checks to see if the value is a class.
     * @param {any} o The value to check.
     * @returns {boolean} True if the value is a class reference.
     */
    isClass (o) {
        return typeof o === 'function' && /^\s*class /.test(o.toString());
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
     * Determines whether the path expression represents a normal file.
     * @param {string} expr The file expression to check.
     * @param {number=} flags Optional flags to request additional details.
     * @param {function(boolean,Error):void} callback An optional callback for async operation.
     * @returns {boolean} True if the parameter is a normal file.
     */
    isFile(expr, flags) {
        return this.isFileSync(expr, flags);
    }

    async isFileAsync(expr, flags) {
        let stat = await driver.fileManager.statAsync(this, expr, flags || 0);
        return stat.isFile;
    }

    isFileSync(expr, flags) {
        let stat = driver.fileManager.statSync(this, expr, flags || 0);
        return stat.isFile;
    }

    /**
     * Determines whether the target value is a living object.
     * @param {any} target The value to check.
     * @returns {boolean} True if the object is alive or false if not.
     */
    isLiving(target) {
        return unwrap(target, (ob) => ob.isLiving(), false);
    }

    /**
     * Determine if an object is a Plain Old Object (POO)
     * @param {any} target The item to inspect
     * @returns {boolean} True if the item is a plain old object.
     */
    isPOO(target) {
        return typeof target === 'object' && target.constructor.name === 'Object' &&
            target.constructor.constructor && target.constructor.constructor.name === 'Function';
    }

    /**
     * Join path
     * @param {...string} expr
     */
    resolvePath(...expr) {
        expr.unshift(this.directory);
        return path.posix.resolve(...expr);
    }

    /**
     * Attempts to find the specified object.  If not found then the object is compiled and returned.
     * @param {string} expr The filename of the object to try and load.
     * @param {any} args If the object is not found then these arguments are passed to the constructor.
     * @param {function(MUDObject):void} [callback] The optional callback if loading asyncronously.
     * @returns {MUDObject} The object (or false if object failed to load)
     */
    loadObjectSync(expr, args, callback) {
        return driver.fileManager.loadObjectSync(this, this.resolvePath(expr), args, callback);
        //let req = this.parsePath(expr), { file } = req,
        //    module = driver.cache.get(file);

        //if (module) {
        //    let req = this.parsePath(expr);
        //    return module.getInstanceWrapper(req);
        //}
        //driver.fileManager.loadObjectSync(this, req, args, callback);
        //module = driver.cache.get(file);
        //return module && module.getInstanceWrapper(req);
    }

    /**
     * Move a directory I guess.  Seems like a bad idea, now.
     * @param {string} source The file to move.
     * @param {string} destination The destination for the new file.
     * @param {MUDFS.MoveOptions} options Options related to the move operation.
     * @param {function(boolean,Error):void} callback Optional callback indicates async mode.
     * @returns {boolean} True on success.
     */
    movePath(source, destination, options, callback) {
        return driver.fileManager.movePath(this,
            this.resolvePath(source),
            this.resolvePath(destination),
            options);
    }

    /**
     * Writes content to a log file.
     * @param {string} file The file to write to.
     * @param {string} message The message to write to
     * @param {any} callback An optional callback
     * @returns {boolean} True on success.
     */
    log(file, message) {
        let logPath = path.posix.join(driver.config.mudlib.logDirectory, file);
        return driver.fileManager.writeFileSync(this, logPath, message + '\n', 1);
    }

    merge(...o) {
        return Object.assign({}, ...o);
    }

    /**
     * Send a message to one or more recipients.
     * @param {string} messageType The message classification.
     * @param {string|MUDHtmlComponent|number|function} expr The message expression to display.
     * @param {MUDObject|MUDObject[]} audience One or more recipients to send the message to.
     * @param {MUDObject|MUDObject[]} excluded One or more objects to explicitly exclude from receiving the message.
     * @returns {void} Returns nothing.
     */
    message(messageType, expr, audience, excluded) {
        if (expr) {
            if (!excluded)
                excluded = [];

            if (!Array.isArray(excluded))
                excluded = [excluded];

            if (!Array.isArray(audience)) {
                audience = [audience || this.thisPlayer()];
            }

            if (typeof expr !== 'string') {
                if (expr instanceof MUDHtmlComponent)
                    expr = expr.render();
                else if (typeof expr === 'number')
                    expr = expr.toString();
                else if (typeof expr !== 'function')
                    throw new Error(`Bad argument 2 to message; Expected string, number, or MUDHtmlComponent but received ${typeof expr}`);
            }
            let filtered = excluded
                .map(m => unwrap(m))
                .filter(m => m instanceof MUDObject);

            let recipients = audience
                .map(m => unwrap(m))
                .filter(m => m instanceof MUDObject && filtered.indexOf(m) === -1);

            if (typeof expr === 'function') {
                driver.driverCall('message', () => {
                    recipients.forEach(player => {
                        let playerMessage = expr(player) || false;
                        playerMessage && player.receiveMessage(messageType, playerMessage);
                    });
                });
            }
            else {
                driver.driverCall('message', () => {
                    recipients.forEach(player => {
                        player.receiveMessage(messageType, expr);
                    });
                });
            }
        }
    }

    /**
     * Create a directory in the MUD filesystem.
     * @param {string} expr The file expression to turn into a directory.
     * @param {MkDirOptions} opts Optional flags to pass to createDirectory.
     * @returns {boolean} True if the directory was created (or already exists)
     */
    mkdir(expr, opts) {
        return driver.fileManager.createDirectorySync(this, expr, opts || 0);
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
     * Splits a file/object name into it's components (path, type name, instance ID)
     * @param {string} fileExpr The file expression.
     * @returns {{ file: string, type: string, instance: number }} Information about the path.
     */
    parsePath(fileExpr) {
        if (typeof fileExpr !== 'string' || fileExpr.length < 2)
            throw new Error('Bad argument 1 to parsePath');

        let [path, instance] = (fileExpr.startsWith('/') ? fileExpr : this.resolvePath(fileExpr)).split('#'),
            [file, type] = path.split('$');

        if ((instance = parseInt(instance)) < 0 || isNaN(instance))
            instance = 0;
        if (!type || type.length === 0) {
            type = file.slice(file.lastIndexOf('/') + 1);
        }
        if (!type)
            throw new Error(`Bad file expression: ${fileExpr}`);
        return Object.freeze({ file, type, instance });
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
                break;

            case 'g':
                if (whatLC === 'gum' || whatLC === 'giraffe')
                    found = PLURAL_SUFFIX;
                else if (whatLC === 'glasses')
                    found = PLURAL_SAME;
                else if (whatLC === 'goose') {
                    found = PLURAL_CHOP + 4;
                    suffix = 'eese';
                }
                else if (whatLC === 'go') {
                    found = PLURAL_SUFFIX;
                    suffix = 'es';
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
            let getEnd = (n) => {
                var a = [].slice.call(arguments, 1),
                    r = whatLC.slice(whatLC.length - n);
                if (a.length) return a.filter(_ => _ === r).length > 0;
                return r;
            };
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
            else { idList.pop(), which--; }

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
     * 
     * @param {number=} n
     */
    previousObject(n) {
        let ctx = driver.getContext(),
            back = parseInt(n) || 0,
            prev = ctx ? ctx.objectStack : [];
        return n === -1 ? prev.slice(1).map(f => f) : prev[n + 1];
    }

    /**
     * Check to see how long a particular user has been idle.
     * @param {MUDObject} target An interactive user object.
     * @returns {number} The amount of idle time in milliseconds.
     */
    queryIdle(target) {
        return unwrap(target, ob => {
            let $storage = driver.storage.get(ob);
            if ($storage.flags & MUDStorage.Interactive) {
                if ($storage.flags & MUDStorage.Connected) {
                    return $storage.client.idleTime;
                }
                return -1;
            }
            return 0;
        });
    }

    /**
     * Returns the current verb if a command is being executed.
     * @returns {string} The verb currently being executed.
     */
    queryVerb() {
        let ctx = driver.currentContext;
        return ctx && ctx.input && ctx.input.verb;
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
     * @returns {string} Reads the file contents if read synchronously.
     */
    readFileSync(filename) {
        return driver.fileManager.readFileSync(this, this.resolvePath(filename));
    }

    /**
     * Attempt to read JSON data from a file.
     * @param {string} filename The file to try and read.
     * @param {function=} callback An optional callback for async reads.
     */
    readJsonFile(filename, callback) {
        return driver.fileManager.readJsonFile(this, this.resolvePath(filename), callback);
    }

    /**
     * Attempts to reload an object
     * @param {string} path The object to reload.
     * @returns {boolean} Returns true if the object recompiled successfully.
     */
    reloadObject(path) {
        return driver.fileManager.reloadObject(this, this.resolvePath(path));
    }

    /**
     * Import one or more required resources from another module.
     * @param {string} moduleName The module name to import.
     * @returns {any} The results of the import.
     */
    require(moduleName) {
        if (typeof moduleName === 'string') {
            switch (moduleName) {
                case 'lpc':
                    return require('./LPCCompat');

                case 'path':
                    return path.posix;

                case 'async':
                case 'net':
                    return require(moduleName);

                default:
                    let isInclude = moduleName.indexOf('/') === -1,
                        filename = isInclude ?
                            this.resolveInclude(moduleName) :
                            this.resolvePath(moduleName, this.directory),
                        module = driver.compiler.compileObject({
                            file: filename,
                            reload: false,
                            relativePath: this.directory
                        });
                    if (!module)
                        throw new Error(`Failed to load required module '${filename}'`);
                    return module.exports;
            }
        }
    }

    /**
     * Attempt to find an include file.
     * @param {string} file The include file to locate.
     * @returns {string|false} Returns the path name of the file or false if not found.
     */
    resolveInclude(file, ignoreCache) {
        let result = !ignoreCache && IncludeCache[file];

        if (!result) {
            for (let i = 0, max = driver.includePath.length; i < max; i++) {
                try {
                    let p = driver.includePath[i],
                        files = this.readDirectorySync(path.posix.join(p, file) + '.*', MUDFS.GetDirFlags.FullPath);
                    if (files.length === 1) {
                        return IncludeCache[file] = files[0];
                    }
                }
                catch (e) {
                    /* do nothing */
                }
            }
            if (!result)
                throw new Error(`Could not find file <${file}> in search path ${driver.includePath.join(':')}`);
        }
        return result;
    }

    /**
     * Attempt to convert a partial MUD path into a fully-qualified MUD path.
     * TODO: Rewrite this ugly method to be more like path.resolve()
     * @param {string} expr The expression to resolve.
     * @param {string} expr2 The relative directory to resolve from.
     * @param {function(string): any} callback The callback to execute when complete... why?
     * @returns {string} The resolved directory
     */
    resolvePath(expr, expr2, callback) {
        callback = callback || typeof expr2 === 'function' && expr2;
        expr2 = typeof expr2 === 'string' && expr2 || this.directory;
        if (typeof expr !== 'string')
            throw new Error('Bad argument 1 to resolvePath');
        if (expr[0] === '/')
            return typeof callback === 'function' && callback(expr) || expr;
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
        let result = path.posix.join(expr2, expr);
        return typeof callback === 'function' ? callback(result) : result;
    }

    /**
     * Restores the state of an object from file.
     * @param {string} path The file to read properties from.
     */
    restoreObject(path) {
        let result = false;
        try {
            let ctx = driver.getContext(),
                thisOb = ctx.thisObject;

            if (thisOb) {
                if (!path.endsWith(SaveExtension))
                    path += SaveExtension;
                if (this.isFile(path)) {
                    let data = this.readJsonFile(path);
                    if (data) {
                        let $storage = driver.storage.get(thisOb);
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

    /**
     * Delete a directory from the filesystem.
     * @param {string} expr
     * @param {any} opts Future use options
     * @param {function(boolean, Error):void} callback Callback for async deletion.
     */
    rmdir(expr, opts, callback) {
        if (typeof opts === 'function') {
            callback = opts;
            opts = { flags: 0 };
        }
        else if (typeof opts === 'number') {
            opts = { flags: opts };
        }
        return driver.fileManager.deleteDirectory(this, expr, opts || {}, callback);
    }

    /**
     * 
     * @param {string} path The path to save to.
     */
    saveObject(path) {
        try {
            let ctx = driver.getContext();
            let prev = ctx.thisObject;

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
     * @param {function(FileSystemStat,Error):void} callback An optional callback for async operation.
     */
    stat(filepath, flags, callback) {
        return driver.fileManager.statFile(this, filepath, flags, callback);
    }

    /**
     * Removes color codes from a string.
     * @param {string} str The string to remove color from.
     * @returns {string} The string minus any color encoding.
     */
    stripColor(str) {
        return str.replace(/(\%\^[A-Z]+\%\^)/g, '');
    }

    /**
     * Shut the game down
     * @param {number} errCode The error code associated with the shutdown.
     * @param {string} reason The reason given for the shutdown.
     */
    shutdown(errCode, reason) {
        if (driver.validShutdown(this, reason)) {
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
        let mec = driver.getExecution();
        return mec && mec.thisObject;
    }

    thisPlayer(flag) {
        let mec = driver.getExecution();
        return flag === true ? mec.truePlayer : mec.thisPlayer;
    }

    /**
     * Simulates a standard time call that returns number of seconds since epoch
     * @returns {number} The number of seconds since January 1, 1970
     */
    time() {
        let t = new Date().getTime() / 1000;
        return Math.floor(t);
    }


    /**
     * Starts a new context that does not include any previous frames.
     * @param {function} callback The code to execute in unguarded mode.
     * @returns {any} The result of the unguarded call.
     */
    unguarded(callback) {
        let ecc = driver.getExecution();

        ecc.push(ecc.thisObject, 'unguarded', this.fileName);
        ecc.stack[0].unguarded = true;

        try {
            return callback();
        }
        finally {
            ecc.pop('unguarded');
        }
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
     * 
     * @param {string} text
     * @param {number=} maxLength
     * @param {string=} lineBreak
     */
    wrapText(text, maxLength, lineBreak, indent) {
        var result = [], line = [];
        var length = 0;
        text = text.replace(/\n/g, ' ');

        maxLength = maxLength || 80;

        text.split(" ").forEach(function (word) {
            if ((length + word.length) >= maxLength) {
                result.push(line.join(" "));
                line = []; length = 0;
            }
            length += word.length + 1;
            line.push(word);
        });
        if (line.length > 0) {
            result.push(line.join(" "));
        }
        return result.join('\n');
    }

    /**
     * Write a message to the current player's screen.
     * @param {string|number|function(...any):string|MUDHtmlComponent} expr The expression to display.
     * @returns {true} Always returns true.
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
     * @returns {void}
     */
    writeFile(filename, content, callback) {
        return driver.fileManager.writeFileSync(this,
            this.resolvePath(filename),
            content,
            callback);
    }

    writeJsonFile(filename, data, callback, replacer) {
        return this.writeFile(filename, JSON.stringify(data, replacer, 2), callback, true);
    }
}

String.prototype.ucfirst = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

/**
 * Configure the EFUNProxy based on configuration
 */
EFUNProxy.configureForRuntime = function () {
    SaveExtension = driver.config.mudlib.defaultSaveExtension;
};

module.exports = EFUNProxy;

