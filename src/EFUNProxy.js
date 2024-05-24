/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    crypto = require('crypto'),
    path = require('path'),
    os = require('os'),
    sprintf = require('sprintf-js').sprintf,
    uuid = require('uuid').v4;

const
    KiloByte = 1024,
    MegaByte = KiloByte * 1000,
    GigaByte = MegaByte * 1000,
    TeraByte = GigaByte * 1000,
    EndsWithWhitespace = /\s+$/;

const
    PLURAL_SUFFIX = 1,
    PLURAL_SAME = 2,
    PLURAL_CHOP = 2;

const
    ArrayHelper = require('./efuns/Arrays'),
    EnglishHelper = require('./efuns/English'),
    FileSystemHelper = require('./efuns/FileSystem'),
    InputHelper = require('./efuns/Inputs'),
    LivingsHelper = require('./efuns/Livings'),
    MathHelper = require('./efuns/MathHelper'),
    ObjectHelper = require('./efuns/ObjectHelper'),
    SecurityHelper = require('./efuns/SecurityHelper'),
    TextHelper = require('./efuns/TextHelper'),
    TimeHelper = require('./efuns/Time'),
    UserHelper = require('./efuns/UserHelper');
    const { ExecutionContext, CallOrigin } = require('./ExecutionContext');
    const MUDObject = require('./MUDObject');

var
    IncludeCache = {},
    Intervals = {},
    SaveExtension = '.json',
    Timeouts = {},
    { MUDHtmlComponent } = require('./MUDHtml');

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
     * @param {number} n The signed value an ansolute value for.
     * @returns {number} The unsigned absolute value.
     */
    abs(n) {
        let frame = driver.pushFrame({ method: 'abs', callType: CallOrigin.DriverEfun });
        try {
            return Math.abs(n);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Bind an action to the current player.
     * @param {string} verb The command to bind.
     * @param {function} callback The callback that executes when the action is triggered.
     */
    addAction(verb, callback) {
        let prevObject = this.previousObject(),
            thisObject = this.thisObject();
        let frame = driver.pushFrame({ method: 'addAction', callType: CallOrigin.DriverEfun });

        try {
            let storage = driver.storage.get(prevObject);

            if (storage && storage.living) {
                storage.actionBinder.bindAction(verb, thisObject, callback);
            }
        }
        finally {
            frame.pop();
        }
    }

    addOutputObject(obj) {
        let ecc = driver.getExecution();
        if (ecc.command && Array.isArray(ecc.command.objout)) {
            ecc.command.objout.push(obj);
        }
    }

    /**
     * Determine if an object is an admin.
     * @param {MUDObject} target The target object to check.
     * @returns {boolean} True if the target is an administrator.
     */
    adminp(target) {
        let frame = driver.pushFrame({ method: 'adminp', callType: CallOrigin.DriverEfun });
        try {
            return driver.callApplySync('isAdmin', target);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determine if an object is an arch.
     * @param {MUDObject} target The target objecto  check.
     * @returns {boolean} True if the target is an arch.ca
     */
    archp(target) {
        let frame = driver.pushFrame({ method: 'archp', callType: CallOrigin.DriverEfun });
        try {
            return driver.callApplySync('isArch', target);
        }
        finally {
            frame.pop();
        }
    }

    get arrays() { return ArrayHelper; }

    /**
     * Construct a string representation of multiple substrings
     * @param {string[] | object[]} list The list of items to consolidate
     * @param {boolean} [useOr] Use the word 'or' to construct the last sentence element
     * @param {boolean} [consolidate] Consolidate instances of the same string into one
     * @param {boolean} [useNumbers] Use digits instead of words to consolidate multiple instances
     * @returns {string} The consolidated string
     */
    arrayToSentence(list, useOr = false, consolidate = true, useNumbers = false) {
        let frame = driver.pushFrame({ method: 'arrayToSentence', callType: CallOrigin.DriverEfun });

        try {
            useOr = typeof useOr === 'boolean' ? useOr : false;
            consolidate = typeof consolidate === 'boolean' ? consolidate : true;
            useNumbers = typeof useNumbers === 'boolean' ? useNumbers : false;

            list = list.map(o => {
                let uw = unwrap(o);
                return uw ? uw.toString() : o.toString();
            });

            if (consolidate) {
                let uniq = {}, count = 0;
                list.forEach(s => {
                    if (s in uniq === false) { uniq[s] = 0; count++; }
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
        finally {
            frame.pop();
        }
    }

    /**
     * Create a function binding
     * @param {MUDObject} [target] Optional target object
     * @param {string} methodName The method to bind
     * @param {...any} args
     * @returns {function():any}
     */
    bindFunctionByName(target, methodName, ...args) {
        //  First parameter was not an explicit MUD object; Use thisObject
        if (typeof target === 'string') {
            target = this.thisObject();
            args.unshift(methodName);
            methodName = target;
        }

        if (!targetFunction)
            throw `bindFunctionByName(): Object ${target.filename} does not contain method ${methodName}`;
        else if (typeof targetFunction !== 'function')
            throw `bindFunctionByName(): Object ${target.filename} does not contain method ${methodName}`;
        else if (target instanceof MUDObject === false)
            throw `bindFunctionByName(): Target object is not a valid MUD object`;

        let targetFunction = target[methodName];

        return targetFunction.bind(target, ...args);
    }

    /**
      * Attempt to create a regular expression from a file pattern
      * @param {string} expr The string to convert
      * @param {boolean} exactMatch The pattern must match exactly
      */
    buildFilenamePattern(expr, exactMatch = true) {
        expr = expr.replace(/\]/g, ']{1}')
        expr = expr.replace(/\//g, '\\/');
        expr = expr.replace(/\./g, '\\.');
        expr = expr.replace(/[*]+/g, '[^/]+');
        expr = expr.replace(/\?/g, '.');
        try {
            if (exactMatch)
                return new RegExp('^' + expr + '$');
            else
                return new RegExp(expr + '$');
        }
        catch (err) {
            console.log(err);
        }
        return false;
    }


    callOut(func, delay, ...args) {
        let /** @type {ExecutionContext} */ ecc = driver.getExecution(),
            tob = ecc.thisObject,
            callback = typeof func === 'function' ? func : false;

        if (typeof func === 'string') {
            let method = tob[func];
            if (typeof method === 'function') {
                callback = method.bind(tob, ...args);
            }
        }
        if (typeof callback !== 'function')
            throw new Error(`Bad argument 1 to function; Expected string or function but got ${typeof func}`);

        let handle = setTimeout(() => {
            let prev = ecc.restore();
            try {
                
                callback();
            }
            finally {
                prev.restore();
            }
        }, delay);

        return handle;
    }

    /**
     * Check to see if the specified flag is set
     * @param {number} flags The flags to check
     * @param {number} flag The specific flag(s) to check for
     * @returns {boolean} Returns true if the specified flag is set
     */
    checkFlags(flags = 0, flag = 0) {
        return (flags & flag) === flag ? true : false;
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
        let store = false;

        if (!target) {
            let ecc = driver.getExecution();
            store = driver.storage.get(ecc.player);
        }
        else {
            store = unwrap(target, ob => driver.storage.get(ob));
        }
        if (store) {
            let caps = store.clientCaps;
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
    async cloneObjectAsync(file, ...args) {
        return await driver
            .fileManager
            .cloneObjectAsync(this.resolvePath(file), args);
    }

    /**
     * Render a list of words into columns of the specified width.
     * @param {string|string[]} list A collection of words to format.
     * @param {number} width The maximum column width.
     * @param {MUDObject} [player] The optional player to format for.
     * @returns {string} A page of columns.
     */
    columnText(list, width, player = false) {
        let rows = [],
            row = [],
            longest = 0,
            colCount = 0,
            colWidth = 0;

        if (typeof list === 'string') {
            list = list.split(/\s+/);
        }

        width = (width || this.clientCaps(player || this.thisPlayer()).clientWidth || 80);

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
        return rows.join(this.eol);
    }


    /**
     * Force the previous object to perform an in-game object.
     * @param {string} input The complete command to execute.
     */
    command(input) {
        throw new Error('Not implemented');
    }

    get console() {
        let ecc = driver.getExecution();
        return ecc.shell && ecc.shell.console;
    }

    /**
     * Create an encrypted password.
     * @param {string} plainText The plain text to be encrypted.
     * @param {function} [callback] An optional callback if the operation is async.
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

    get currentCommand() {
        let ecc = driver.getExecution(),
            cmd = ecc.command;

        if (cmd)
            return cmd;
        else
            return { verb: '', args: [] };
    }

    /**
     * Returns the currently executing verb.
     * @returns {string|false} The current verb or false if none.
     */
    get currentVerb() {
        let ecc = driver.getExecution(),
            cmd = ecc.command;

        if (cmd)
            return cmd.verb;
        else
            return '';
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
     * @param {MUDObject} target The object to destruct.
     */
    destruct(target, ...args) {
        let ecc = driver.getExecution();
        let ob = unwrap(target) || this.thisObject();
        if (ob) {
            let store = driver.storage.get(ob);
            if (store) {
                if (ecc.guarded(frame => driver.validDestruct(ob, frame))) {
                    return driver.driverCall('destruct', () => {
                        return store.eventDestroy(...args);
                    });
                }
                else
                    throw Error(`Permission denied: Could not destruct object ${ob.filename}`);
            }
        }
        return false;
    }

    /**
     * Gets the directory name from an object instance.
     * @param {MUDWrapper} target The MUD object.
     */
    directoryName(target) {
        let dir = typeof target === 'object' && unwrap(target, o => o.filename) || target;
        return typeof dir === 'string' && dir.slice(0, dir.lastIndexOf('/'));
    }

    /**
     * Switch an interactive object's body instance.
     * @param {MUDObject} ptrOld The body that is being left behind.
     * @param {MUDObject} ptrNew The body that the user is switching into.
     * @param {function(MUDObject,MUDObject):any} callback The callback to execute when the switch is complete.
     * @returns {boolean} True if the 
     */
    async exec(ptrOld, ptrNew, callback) {
        let ecc = driver.getExecution();

        let oldBody = ptrOld.isWrapper ? ptrOld() : ptrOld;
        let newBody = ptrNew.isWrapper ? ptrNew() : ptrNew;

        if (!ecc.guarded(frame => driver.validExec(frame, oldBody, newBody)))
            throw new Error('Permission denied to efuns.exec()');

        return await driver.driverCallAsync('exec', async ctx => {
            let oldStorage = driver.storage.get(oldBody),
                component = oldStorage.component;

            //  The old storage has no client?!
            if (!component)
                return false;

            let newStorage = driver.storage.get(newBody);

            //  New body is invalid due to storage
            if (!newStorage)
                return false;

            try {
                await newStorage.eventExec(component);
                let result = await callback(oldBody, newBody) || true;
                return result;
            }
            catch (e) {
                /* ack... try and roll back */
                console.log(`Error during exec(): ${e.message}; Rolling back.`);
                try {
                    component.body = oldBody;
                }
                catch (ee) {
                    /* rollback failed, too... destroy them all */
                    this.writeLine('Sorry things did not work out.');
                    await component.disconnect();
                }
                throw e;
            }
        }, this.fileName, true);
    }

    get config() {
        return driver.config.createExport();
    }

    /**
     * Check to see if the string looks like a wildcard pattern
     * @param {string} expr The expression to check
     * @returns {boolean} Returns true if the string looks like a file pattern
     */
    containsWildcard(expr) {
        if (typeof expr !== 'string')
            return false;
        return /[\*\?\[\]]+/.test(expr);
    }

    /** Gets the default export for the module */
    get defaultExport() {
        let module = driver.cache.get(this.fullPath);
        return module.defaultExport;
    }

    /** Sets the default export for the module */
    set defaultExport(val) {
        let module = driver.cache.get(this.fullPath);
        module.addExport(val, true);
    }

    /**
     * Old school ed() support.
     * @param {string} fileName The name of the file to edit.
     * @param {string|function} writeFunc 
     * @param {string|function} exitFunc
     * @param {boolean} [restrict] Run the editor in restricted mode? (defaults to true)
     */
    ed(fileName, writeFunc, exitFunc, restrict = true) {
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

    get english() {
        return EnglishHelper;
    }

    get eol() {
        return '\r\n';
    }

    get exports() {
        let module = driver.cache.get(this.fullPath);
        return Object.assign({}, module.exports);
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
        var parts = this.parsePath(this.resolvePath(filename)),
            module = driver.cache.get(parts.file);

        if (module) {
            return module.getInstanceWrapper(parts);
        }
        return false;
    }

    /**
     * Find a player in the game.
     * @param {string} name The name of the character to find.
     * @param {boolean} usePartial If true then partial name matches are permitted (default: false)
     * @returns {MUDObject} Attempts to return the specified player.
     */
    findPlayer(name, usePartial = false) {
        if (typeof name !== 'string')
            throw new Error(`Bad argument 1 to findPlayer; Expects string got ${(typeof name)}`);
        return driver.playerObjects.find(name, usePartial);
    }

    /**
     * Filesystem-related efuns
     */
    get fs() {
        return FileSystemHelper;
    }

    /**
     * Returns the state of the MUD.
     * @returns {number} The state of the MUD.
     */
    gameState() {
        return driver.gameState;
    }

    getNewId() {
        return uuid();
    }

    get math() {
        return MathHelper;
    }

    /**
     * Converts a numeric storage size into a human-friendly form.
     * @param {number} n A number of bytes
     * @param {number} decim Number of decimal places
     * @returns {string} A human-friendly string.
     */
    getMemSizeString(n,decim=0) {
        let numeric = parseInt(n);

        if (isNaN(numeric))
            return n;

        if (decim > 0)
            decim = -decim;
        if (numeric > TeraByte) {
            return this.math.round10(numeric / TeraByte, decim) + 'TB';
        }
        else if (numeric > GigaByte) {
            return this.math.round10(numeric / GigaByte, decim) + 'GB';
        }
        else if (numeric > MegaByte) {
            return this.math.round10(numeric / MegaByte, decim) + 'MB';
        }
        else if (numeric > KiloByte) {
            return this.math.round10(numeric / KiloByte, decim) + 'KB';
        }
        else {
            return numeric.toString();
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
        return str.split(this.eol)
            .map(s => Array(count || 1).join(pattern || '\t') + s)
            .join(this.eol);
    }

    inherits(ob, targetType) {
        return global.MUDVTable.doesInherit(ob, targetType);
    }

    get input() { return InputHelper; }

    isAsync(expr) {
        return typeof expr === 'function' && expr[Symbol.toStringTag] === 'AsyncFunction';
    }

    /**
     * Check to see if the current call has been awaited
     * @param {boolean} assertIfNotAwaited If true and the call is not awaited then a runtime exception is thrown
     * @returns {boolean}
     */
    isAwaited(assertIfNotAwaited = false, methodName = 'unknown') {
        let ecc = driver.getExecution(),
            result = ecc && ecc.isAwaited,
            frame = ecc && ecc.stack[0] || false;

        if (frame && frame.method === 'constructor')
            throw `Constructor in ${frame.file} [line ${frame.lineNumber}] attempted to call '${methodName}' which is async; Constructors cannot call async methods.`;
        if (!result && assertIfNotAwaited === true) {
            if (frame)
                throw `Method ${frame.method} in ${frame.file} [line ${frame.lineNumber}] requires the use of await; Example: await ${methodName}(...)`;
            else
                throw `Unknown method requires use of await`;
        }
        return result === true;
    }

    /**
     * Checks to see if the value is a class.
     * @param {any} o The value to check.
     * @returns {boolean} True if the value is a class reference.
     */
    isClass (o) {
        return typeof o === 'function' && o.toString().substring(0, 5) === 'class';
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
     * Determine if the target is an error object.
     * @param {any} item The item to check
     * @returns {boolean} Returns true if the item looks like an error object.
     */
    isError(item) {
        if (typeof item === 'object') {
            if (item.constructor.name === 'Error') {
                return ('message' in item) && ('stack' in item);
            }
        }
        return false;
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

    isForced() {
        let ecc = driver.getExecution();
        return ecc.thisPlayer !== ecc.truePlayer;
    }

    isFunction(expr) {
        return expr && typeof expr === 'function';
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
        return typeof target === 'object' &&
            target.constructor.name === 'Object' &&
            target.constructor.constructor &&
            target.constructor.constructor.name === 'Function';
    }

    /**
     * Determine if the target is a promise object.
     * @param {any} item The item to check
     * @returns {boolean} Returns true if the item looks like an Promise object.
     */
    isPromise(item) {
        if (!!item && typeof item === 'object') {
            try {
                let proto = Object.getPrototypeOf(item);
                if (proto.constructor?.name === 'Promise') {
                    return ('then' in item) && ('catch' in item);
                }
            }
            catch (e) {
                console.log(item);
            }
        }
        return false;
    }

    /**
     * Join path
     * @param {...string} expr
     */
    joinPath(...expr) {
        return path.posix.join(...expr);
    }

    /** The livings namespace */
    get living() { return LivingsHelper; }

    async loadObjectAsync(expr, ...args) {
        if (expr instanceof MUDObject)
            return expr;

        if (typeof expr !== 'string') {
            if (typeof expr === 'function' && expr.isWrapper)
                return expr;
            else if (expr instanceof MUDObject)
                return global.wrap(expr);
        }
        return await driver.fileManager.loadObjectAsync(this.resolvePath(expr), args);
    }

    /**
     * Attempts to find the specified object.  If not found then the object is compiled and returned.
     * @param {string} expr The filename of the object to try and load.
     * @param {...any} args If the object is not found then these arguments are passed to the constructor.
     * @returns {MUDObject} The object (or false if object failed to load)
     */
    loadObjectSync(expr, ...args) {
        if (expr instanceof MUDObject)
            return expr;

        if (typeof expr !== 'string') {
            if (typeof expr === 'function' && expr.isWrapper)
                return expr;
            else if (expr instanceof MUDObject)
                return global.wrap(expr);
        }
        return driver.fileManager.loadObjectSync(this.resolvePath(expr), args);
    }

    /**
     * Writes content to a log file.
     * @param {string} file The file to write to.
     * @param {string} message The message to write to
     * @param {any} callback An optional callback
     * @returns {boolean} True on success.
     */
    async log(file, message) {
        let frame = driver.pushFrame({ method: 'log', callType: CallOrigin.DriverEfun, isAsync: true });

        try {
            let logPath = path.posix.resolve(driver.config.mudlib.logDirectory, file),
                logFile = await driver.fileManager.getFileAsync(logPath);

            return await logFile.appendFileAsync(message + this.eol);
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Log an error
     * @param {Error} err
     */
    async logError(err) {
        try {
            return driver.logError(err);
        }
        catch (e) {
        }
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
     * @returns {true} Always returns true.
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
        return true;
    }

    mudInfo() {
        let config = driver.config;
        return {
            arch: os.arch(),
            architecture: os.platform(),
            cpuUsage: process.cpuUsage().user,
            gameDriver: 'Node.js v' + process.versions.node,
            hardware: (function () {
                let cpus = {}, r = [];
                os.cpus().forEach((cpu, i) => {
                    if (!cpus[cpu.model]) cpus[cpu.model] = 0;
                    cpus[cpu.model]++;
                });
                for (let k in cpus) {
                    if (cpus.hasOwnProperty(k))
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
     * @param {boolean} flag If true, then the return value is in an array [name, wantsPlayer]
     * @returns {string} The normalized version of the name e.g. 'bobthebuilder'
     */
    normalizeName(name, flag = false) {
        let wantsPlayer = false;

        if (typeof name !== 'string')
            throw new Error(`Bad argument 1 to normalizeName; Expected string got ${(typeof name)}`);
        if (name.charAt(0) === '@') {
            name = name.slice(1);
            wantsPlayer = true;
        }
        let result = name.toLowerCase().replace(/[^a-zA-Z]+/g, '');
        return flag ? [result, wantsPlayer] : result;
    }

    get objects() {
        return ObjectHelper;
    }

    /**
     * Determine the object type
     * @param {any} arg
     * @returns {'function'|'string'|'number'|'MudObject'|'SimpleObject'|'boolean'|'undefined'|'object'|'array'} Returns the type of object
     */
    objectType(arg) {
        let tt = typeof arg;

        if (Array.isArray(arg))
            return 'array';
        else if (tt === 'string' || tt === 'bigint' || tt === 'boolean' || tt === 'number' || tt === 'undefined' || tt === 'symbol')
            return tt;

        arg = unwrap(arg) || arg;
        if (typeof arg === 'object') {
            if (arg instanceof MUDObject) 
                return 'MudObject';
            else if (typeof arg.filename === 'string' && arg.constructor.name) 
                return 'SimpleObject';
            else if (Array.isArray(arg))
                return 'array';
            else 
                return 'object';
        }
        return typeof arg;
    }

    origin() {
        let ecc = driver.getExecution(),
            frame = ecc && ecc.stack[0];

        return frame ? frame.origin : 0;
    }

    /**
     * Determines whether a value is a player or not.
     * @param {any} target The value to check.
     * @returns {boolean} True if the value is a player or false.
     */
    playerp(target) {
        return this.living.isPlayer(target);
    }

    /**
     * Splits a file/object name into it's components (path, type name, instance ID)
     * @param {string} fileExpr The file expression.
     * @returns {{ file: string, type: string, extension?: string, objectId: string }} Information about the path.
     */
    parsePath(fileExpr) {
        if (typeof fileExpr !== 'string' || fileExpr.length < 2)
            throw new Error('Bad argument 1 to parsePath');

        let ls = fileExpr.lastIndexOf('/'),
            ld = fileExpr.lastIndexOf('.'),
            ext = ld > -1 && ld > ls ? fileExpr.slice(ld) : false,
            n = ext && ext.indexOf('$');

        if (n !== false && n > -1)
            ext = ext.slice(0, n);

        if (ld > ls) {
            fileExpr = fileExpr.slice(0, ld);
        }

        let [path, objectId] = (fileExpr.startsWith('/') ? fileExpr : this.resolvePath(fileExpr)).split('#', 2),
            [file, type] = path.split('$', 2);

        if (!type || type.length === 0) {
            type = file.slice(file.lastIndexOf('/') + 1);
        }
        if (!type)
            throw new Error(`Bad file expression: ${fileExpr}`);

        let defaultType = file.endsWith(`/${type}`);
        let result = Object.freeze({ file, type, extension: ext, objectId, defaultType });

        return result;
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
    present(id, env=false, returnAll=false) {
        if (!env) {
            env = this.thisObject();
        }
        if (typeof id === 'string') {
            let parts = id.split(/\s+/),
                lastPart = parts.length > 1 && parts.pop(),
                numberedSpec = lastPart && parseInt(lastPart);

            if (lastPart && (isNaN(numberedSpec) || numberedSpec < 1)) {
                numberedSpec = 0;
                parts.push(lastPart);
            }

            let matches = env.inventory.filter(o => {
                for (const p of parts) {
                    if (!o.id(p)) return false;
                }
                return true;
            });

            if (numberedSpec--) {
                return matches.length > numberedSpec ? matches[numberedSpec] : false;
            }
            if (returnAll === true)
                return matches;
            else if (matches.length > 0)
                return matches[0];
            else
                return false;
        }
        else if (typeof id === 'object' && id instanceof MUDObject) {
            if (id.environment === env)
                return id;
            let foo = id.environment.environment;
            while (foo) {
                if (foo === env)
                    return id;
                foo = foo.environment;
            }
            return false;
        }
        throw new Error(`Bad argument 1 to present(); Expected string or object but got ${typeof arguments[0]}`);
    }

    /**
     * 
     * @param {number} n The number of objects to go back
     * @returns {MUDObject}
     */
    previousObject(n = 1) {
        let ctx = driver.getExecution(),
            prev = ctx.previousObjects;
        return n === -1 ? prev.slice(0) : prev[n];
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
     * Attempts to reload an object
     * @param {string} expr The object to reload.
     * @returns {boolean} Returns true if the object recompiled successfully.
     */
    async reloadObjectAsync(expr) {
        return await driver.fileManager
            .loadObjectAsync(this.resolvePath(expr), undefined, 1);
    }

    /**
     * Attempts to reload an object
     * @param {string} expr The object to reload.
     * @returns {boolean} Returns true if the object recompiled successfully.
     */
    reloadObjectSync(expr) {
        return driver.fileManager
            .loadObjectAsync(this.resolvePath(expr), undefined, 1);
    }

    /**
     * Import one or more required resources from another module.
     * @param {string} moduleName The module name to import.
     * @returns {any} The results of the import.
     */
    require(moduleName) {
        const result = (async (moduleName) => {
            return await this.requireAsync(moduleName);
        })(moduleName);

        return result;
    }

    /**
     * Import one or more required resources from another module.
     * @param {string} moduleName The module name to import.
     * @returns {any} The results of the import.
     */
    async requireAsync(moduleName) {
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
                            await this.resolveIncludeAsync(moduleName) :
                            await this.resolvePath(moduleName, this.directoryName(this.filename)),
                        module = driver.cache.get(filename);

                    if (!module)
                        module = await driver.compiler.compileObjectAsync({
                            file: filename,
                            reload: false,
                            relativePath: this.directory
                        });
                    if (!module)
                        throw new Error(`Failed to load required module '${filename}'`);
                    else if (module.isCompiling)
                        throw new Error(`Circular dependency detected: ${module.filename} <-> ${this.fileName}`);

                    if (module.exports.length === 1)
                        return module.defaultExport;
                    else
                        return Object.assign({}, module.exports);
            }
        }
    }

    async importAsync(moduleName, specifiers, relativePath = false) {
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
                            await this.resolveIncludeAsync(moduleName) :
                            await this.resolvePath(moduleName, relativePath || this.directoryName(this.filename)),
                        module = driver.cache.get(filename);

                    if (!module)
                        module = await driver.compiler.compileObjectAsync({
                            file: filename,
                            reload: false,
                            relativePath: this.directory
                        });
                    if (!module)
                        throw new Error(`Failed to load required module '${filename}'`);
                    else if (module.isCompiling)
                        throw new Error(`Circular dependency detected: ${module.filename} <-> ${this.fileName}`);

                    let result = {};
                    for (const [exportAs, definedAs] of Object.entries(specifiers)) {
                        if (definedAs === 'default')
                            result[exportAs] = module.defaultExport;
                        else if (definedAs === 'exports')
                            result[exportAs] = Object.assign({}, module.exports);
                        else if (definedAs in module.exports)
                            result[exportAs] = module.exports[definedAs];
                        else
                            throw new Error(`SyntaxError: The requested module '${filename}' does not provide an export named '${definedAs}'`);
                    }
                    return result;
            }
        }
    }

    /**
     * Attempt to find an include file.
     * @param {string} file The include file to locate.
     * @returns {string|false} Returns the path name of the file or false if not found.
     */
    async resolveIncludeAsync(file, ignoreCache) {
        let result = !ignoreCache && IncludeCache[file];
        let includePath = [this.directory];

        //  TODO: Fix all code to require @ prefix to use search path
        if (file.charAt(0) === '@') {
            file = file.slice(1);
            includePath = includePath.concat(driver.includePath);
        }
        else {
            //includePath = includePath.concat(driver.includePath);
        }

        if (!result) {
            for (let i = 0, max = includePath.length; i < max; i++) {
                try {
                    let dir = await this.fs.getDirectoryAsync(includePath[i]),
                        files = await dir.readAsync(file + '.*');
                    if (files.length === 1) {
                        return IncludeCache[file] = files[0].path;
                    }
                }
                catch (e) {
                    console.log(e);
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
     * @param {string} relativeToPath The relative directory to resolve from.
     * @returns {string} The resolved directory
     */
    resolvePath(expr, relativeToPath) {
        relativeToPath = typeof relativeToPath === 'string' && relativeToPath || this.directory;

        if (typeof expr !== 'string')
            throw new Error(`Bad argument 1 to resolvePath; Expected string got ${(typeof expr)}`);

        if (expr.charAt(0) === '/')
            return expr;
        else if (expr.charAt(0) === '~') {
            let re = /^~([\\\/])*([^\\\/]+)/,
                m = re.exec(expr) || [];

            if (m.length === 2) {
                let homePath = this.user.getHomePath(m[2]);
                expr = homePath + expr.slice(m[2].length + 1);
            }
            else if (expr[1] === '/' || expr === '~') {
                let player = this.thisPlayer();
                expr = player ?
                    this.user.getHomePath(player) + expr.slice(1) :
                    this.directory + expr.slice(1);
                return expr;
            }
            else if (m.length === 3 && !m[1]) {
                // TODO: Remove lib-specific home directory logic
                expr = '/realms/' + expr.slice(1);
            }
        }
        else if (expr.charAt(0) === '^') {
            // TODO: Remove lib-specific home directory logic
            expr = '/world/' + expr.slice(1);
        }
        return path.posix.resolve(relativeToPath, expr);
    }

    restoreObject(data) {
        let parts = this.parsePath(data.$type),
            module = driver.cache.get(parts.file),
            ctx = driver.getExecution(),
            prev = ctx.previousObject;

        return module.create(parts.type, data);
    }

    /**
     * Restores the state of an object from file.
     * @param {string} pathOrObject The file to read properties from.
     */
    async restoreObjectAsync(pathOrObject) {
        try {
            if (this.objectType(pathOrObject) === 'object' && '$type' in pathOrObject) {
                let $type = pathOrObject.$type,
                    parts = this.parsePath($type),
                    ecc = driver.getExecution();

                if (await ecc.guarded(f => driver.validRead(f, $type))) {
                    let clone = await this.cloneObjectAsync($type),
                        store = driver.storage.get(clone);
                    return !!store && await store.eventRestore(pathOrObject);
                }
                return false;
            }
            else {
                let ecc = driver.getExecution(),
                    thisOb = ecc.thisObject,
                    restoreFile = this.resolvePath(pathOrObject, thisOb.directory);

                if (thisOb) {
                    if (!restoreFile.endsWith(SaveExtension))
                        restoreFile += SaveExtension;
                    let dataFile = await this.fs.getFileAsync(restoreFile);
                    if (dataFile.exists) {
                        let data = await dataFile.readJsonAsync();
                        let store = driver.storage.get(thisOb);
                        return store ? await store.eventRestore(data) : false;
                    }
                }
            }
        }
        catch (err) {
            logger.log('restoreObject', err);
        }
        return false;
    }

    get saveExtension() {
        return SaveExtension.slice(0);
    }

    /**
     * 
     * @param {string} expr The path to save to.
     */
    saveObject(expr) {
        try {
            let ctx = driver.getExecution(), prev = ctx.thisObject,
                parts = this.parsePath(prev.filename);

            expr = expr || parts.file;

            if (prev) {
                if (!expr.endsWith(SaveExtension)) expr += SaveExtension;
                this.writeJsonFile(expr, this.serialize(prev));
                return true;
            }
        }
        catch (err) {
            logger.log('saveObject', err);
        }
        return false;
    }

    /**
     * Saves an object state to the specified file
     * @param {string} expr The path to save to.
     * @param {string} [encoding] The encoding to use when serialize (defaults to utf8)
     */
    async saveObjectAsync(expr, encoding = 'utf8') {
        try {
            let ctx = driver.getExecution(),
                prev = ctx.thisObject,
                parts = this.parsePath(prev.filename),
                savePath = this.resolvePath(expr || parts.file, prev.directory);

            if (prev) {
                if (!savePath.endsWith(SaveExtension))
                    savePath += SaveExtension;
                let data = this.serialize(prev);
                return await this.fs.writeJsonAsync(savePath, data, 0, encoding);
            }
        }
        catch (err) {
            logger.log('saveObject', err);
        }
        return false;
    }

    get security() {
        return SecurityHelper;
    }

    /**
     * Serialize an object for saving.
     * @param {any} target
     */
    serialize(target) {
        let finalResult = unwrap(target, targetObject => {
            let serializeMudObject,
                serializeSimpleObject,
                serializeValue = (hive, key, val) => {
                    let vt = this.objectType(val);

                    hive = hive || {};

                    if (['number', 'string', 'boolean', 'bigint'].indexOf(vt) > -1)
                        return hive[key] = val;
                    else if (vt === 'object') {
                        hive = hive[key] = {};
                        for (const [sk, v] of Object.entries(val)) {
                            if (!sk.startsWith('$'))
                                serializeValue(hive, sk, v);
                        }
                        return hive;
                    }
                    else if (vt === 'MudObject')
                        return hive[key] = serializeMudObject(val);
                    else if (vt === 'SimpleObject')
                        return hive[key] = serializeSimpleObject(val);
                    else if (Array.isArray(val))
                        return hive[key] = val.map(v => serializeValue(false, false, v));
                    else
                        return hive[key] = val;
                };

            serializeSimpleObject = (val) => {
                let result = {
                    $type: val.filename,
                    $simpleType: true,
                    properties: {}
                };

                let props = Object.getOwnPropertyDescriptors(val);
                driver.driverCall('serialize', () => {
                    Object.keys(props).forEach(prop => {
                        if (!prop.startsWith('$')) {
                            let descriptor = props[prop], propVal;
                            if (descriptor.get)
                                propVal = descriptor.get.apply(val);
                            else
                                propVal = val[prop];
                            if (typeof propVal !== 'undefined')
                                serializeValue(result.properties, prop, propVal);
                        }
                    });
                });
                return result;
            };

            serializeMudObject = target => {
                let ob = typeof target === 'function' ? unwrap(target) : target;
                let store = driver.storage.get(ob),
                    result = {
                        $type: ob.filename,
                        environment: store && unwrap(store.environment, e => e.filename),
                        flags: store.flags,
                        inventory: store && store.inventory.map(i => unwrap(i, item => serializeMudObject(item))) || {},
                        properties: {}
                    };

                if (store === false) {
                    driver.driverCall('serialize', () => {
                        Object.getOwnPropertyNames(ob).forEach(p => {
                            if (!p.startsWith('$')) {
                                serializeValue(result.properties, p, ob[p]);
                            }
                        });
                    });
                }
                else
                    Object.keys(store.properties).forEach(key => {
                        let val = store.properties[key];
                        if (!key.startsWith('$')) {
                            serializeValue(result.properties, key, val);
                        }
                    });
               return result;
            };

            return serializeMudObject(targetObject);
        });
        return finalResult;
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
            driver.registerResetTime(ob, efuns.ticks + interval);
        });
    }

    get env() {
        let ecc = driver.getExecution(),
            cmd = ecc.command;
        return cmd.env || {};
    }

    get err() {
        let ecc = driver.getExecution(),
            cmd = ecc.command;
        if (cmd && cmd.stderr)
            return cmd.stderr;
        return ecc.shell && ecc.shell.console;
    }

    get in() {
        let ecc = driver.getExecution(),
            cmd = ecc.command;
        if (cmd && cmd.stdin)
            return cmd.stdin;
        return false;
    }

    get objin() {
        let ecc = driver.getExecution(),
            cmd = ecc.command;
        if (cmd && Array.isArray(cmd.objin))
            return cmd.objin;
        return false;
    }

    get out() {
        let ecc = driver.getExecution(),
            cmd = ecc.command;
        if (cmd && cmd.stdout)
            return cmd.stdout;
        return ecc.shell && ecc.shell.console;
    }

    /**
     * Produce a random number in the specified range
     * @param {number} min
     * @param {number} max
     * @returns
     */
    random(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);

        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Roll the dice...
     * @param {number|string} rollCount 
     * @param {number} dieFaces
     * @param {number} modifier
     */
    roll(rollCount, dieFaces = 1, modifier = 0) {

        if (typeof rollCount === 'string') {
            rollCount = rollCount.replace(/[^\dd\+\-]+/g, '');

            let info = rollCount.split(/([d\+\-])/).map((s, i) => {
                if (s === '+' || s === '-')
                    return s;
                else if (s === 'd')
                    return false;
                return parseInt(s) || 1;
            }).filter(s => s !== false);

            if (info.length === 1)
                throw new Error(`Illegal dice expression: ${rollCount}`);

            else if (info.length === 4) {
                let withSign = `${info[2]}${info[3]}`;
                info[2] = parseInt(withSign);
                info.pop();
            }

            rollCount = info.shift();
            dieFaces = info.shift() || 6;
            modifier = info.shift() || 0;
        }

        let total = 0;
        for (let i = 0; i < rollCount; i++) {
            total += Math.floor(Math.random() * dieFaces) + 1;
        }
        return Math.max(0, total + modifier);
    }

    /** Sets the default export for the module */
    async setDefaultExport(val) {
        let module = driver.cache.get(this.fullPath);
        return await module.setDefaultExport(val, true);
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
    async shutdown(errCode, reason) {
        let ecc = driver.getExecution();
        if (await ecc.guarded(f => driver.validShutdown(f))) {
            process.exit(errCode || 0);
        }
    }

    sprintf(...args) {
        return sprintf.apply(sprintf, args);
    }

    stripBOM(content) {
        if (typeof content === 'string') {
            if (content.charCodeAt(0) === 0xFEFF)
                content = content.slice(1);
        }
        else if (content.buffer && content.buffer[0] === 0xFEFF)
            content = content.slice(1);
        else if (content.slice && content.slice(0, 3).join(',') === '239,187,191')
            content = content.slice(3);
        return content;
    }

    get text() {
        return TextHelper;
    }

    /**
     * Returns the upper-most object on the stack.
     * @returns {MUDObject|false} The last object to interact with the MUD or false if none.
     */
    thisObject() {
        let ecc = driver.getExecution();
        return ecc && ecc.previousObjects[0];
    }

    thisPlayer(flag) {
        let mec = driver.getExecution();
        return flag === true ? mec.truePlayer : mec.player;
    }

    /**
     * Simulates a standard time call that returns number of seconds since epoch
     * @returns {number} The number of seconds since January 1, 1970
     */
    get time() {
        return TimeHelper;
    }

    get ticks() {
        return new Date().getTime();
    }

    /**
     * Starts a new context that does not include any previous frames.
     * @param {function} callback The code to execute in unguarded mode.
     * @returns {any} The result of the unguarded call.
     */
    async unguarded(callback) {
        if (typeof callback !== 'function')
            throw new Error(`Bad argument 1 to unguarded; expected function got ${typeof callback}`);
        let ecc = driver.getExecution(),
            frame = ecc.pushFrameObject({ method: 'unguarded', isAsync: this.isAsync(callback), isUnguarded: true });

        try {
            if (this.isAsync(callback))
                return await callback();
            else
                return callback();
        }
        finally {
            frame.pop();
        }
    }

    get user() {
        return UserHelper;
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
            return player.filename.startsWith('/sys/data/creators/');
        });
    }

    /**
     * 
     * @param {string} text
     * @param {number=} maxLength
     * @param {string=} lineBreak
     */
    wrapText(text, maxLength, lineBreak, indent) {
        text = text.replace(/[\r\n]+/g, ' ');
        maxLength = maxLength || this.env.COLUMNS || 80;

        if (typeof maxLength === 'function')
            maxLength = maxLength();

        let wordsAndSpace = text.split(/(\s+)/g),
            line = '',
            lineLength = 0,
            lines = [];

        for (const chunk of wordsAndSpace) {
            let clen = this.stripColor(chunk).length;

            if ((lineLength + clen) > maxLength) {
                lines.push(line);
                if (!/^\s+$/.test(chunk)) {
                    line = chunk;
                    lineLength = clen;
                }
                else {
                    line = '';
                    lineLength = 0;
                }
            }
            else {
                line += chunk;
                lineLength += clen;
            }
        }
        if (!/^\s+$/.test(line))
            lines.push(line);
        return lines.join('\n');
    }

    error(...expr) {
        let ecc = driver.getExecution(),
            cmd = ecc.command,
            ec = cmd?.env?.ERRORCOLOR;

        if (ec) {
            expr = expr.map(s => '%^BOLD%^%^' + ec + '%^' + s + '%^RESET%^');
        }
        this.writeToStream(false, this.err, ...expr);
        return false;
    }

    errorLine(...expr) {
        let ecc = driver.getExecution(),
            cmd = ecc.command,
            ec = cmd?.env?.ERRORCOLOR;

        if (ec) {
            expr = expr.map(s => '%^BOLD%^%^' + ec + '%^' + s + '%^RESET%^');
        }

        this.writeToStream(true, this.err, ...expr);
        return false;
    }

    write(...expr) {
        return this.writeToStream(false, this.out, ...expr);
    }

    writeLine(...expr) {
        return this.writeToStream(true, this.out, ...expr);
    }

    /**
     * Write a message to the current player's screen.
     * @param {boolean} appendNewline If true then a newline is automatically appended at the end 
     * @param {...any} expr The expression to display.
     * @returns {true} Always returns true.
     */
    writeToStream(appendNewline = true, stream = false, ...expr) {
        stream = stream || this.out;

        if (!stream)
            return false;
        else
            return driver.driverCall('write', ecc => {
                let expandValue = /** @returns {string[]} */ item => {
                    let valType = typeof item;
                    if (valType === 'string')
                        return [item];
                    else if (valType === 'function') {
                        item = item();
                        if (typeof item !== 'string') item = '';
                        return [item];
                    }
                    else if (valType === 'number')
                        return [item.toString()];
                    else if (valType === 'boolean')
                        return [item ? 'true' : 'false'];
                    else if (Array.isArray(item)) {
                        let r = [];
                        item.forEach(i => r.push(...expandValue(i)));
                        return r;
                    }
                    else
                        return [valType.toUpperCase()];
                };
                /** @type {string[]} */
                let items = [], content = '';

                expr.map(item => items.push(...expandValue(item)));
                items.filter(v => v.length > 0).forEach((v, i) => {
                    if (i === 0)
                        content += v;
                    else if (EndsWithWhitespace.test(v)) {
                        content += v;
                    }
                    else
                        content += ' ' + v;
                });

                if (appendNewline) {
                    if (!efuns.text.trailingNewline(content)) content += this.eol;
                }

                if (stream)
                    stream.write(content);

                return true;
            });
    }

    writeRaw(expr) {
        return driver.driverCall('write', ecc => {
            ecc.stdout.write(expr);
            this.message('write', expr, this.thisPlayer());
            return true;
        });
    }

    /**
     * Write text to file.
     * @param {string} filename The file to write to.
     * @param {string} content The content to write.
     * @returns {void}
     */
    writeFile(filename, content, callback) {
        return driver.fileManager.writeFileSync(
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

