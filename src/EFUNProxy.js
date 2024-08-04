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
const { ExecutionContext, CallOrigin, ExecutionFrame } = require('./ExecutionContext');
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
        this.fs = new FileSystemHelper(this);
    }

    /**
     * Bind an action to the current player.
     * @param {ExecutionContext} ecc
     * @param {string} verb The command to bind.
     * @param {function} callback The callback that executes when the action is triggered.
     */
    addAction(ecc, verb, callback) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'addAction', callType: CallOrigin.DriverEfun });
        try {
            let prevObject = this.previousObject(frame.branch()),
                thisObject = frame.context.thisObject;

            let storage = driver.storage.get(prevObject);

            if (storage && storage.living) {
                storage.actionBinder.bindAction(verb, thisObject, callback);
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Add an output object to the object buffer
     * @param {ExecutionContext} ecc
     * @param {any} obj
     */
    addOutputObject(ecc, obj) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'addOutputObject', callType: CallOrigin.DriverEfun });
        try {
            if (ecc.command && Array.isArray(ecc.command.objout)) {
                ecc.command.objout.push(obj);
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determine if an object is an admin.
     * @param {ExecutionContext} ecc
     * @param {MUDObject} target The target object to check.
     * @returns {boolean} True if the target is an administrator.
     */
    adminp(ecc, target) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'adminp', callType: CallOrigin.DriverEfun });
        try {
            return driver.callApplySync(frame.context, 'isAdmin', target);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determine if an object is an arch.
     * @param {ExecutionContext} ecc
     * @param {MUDObject} target The target objecto  check.
     * @returns {boolean} True if the target is an arch.ca
     */
    archp(ecc, target) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'archp', callType: CallOrigin.DriverEfun });
        try {
            return driver.callApplySync(frame.context, 'isArch', target);
        }
        finally {
            frame.pop();
        }
    }

    get arrays() { return ArrayHelper; }

    /**
     * Construct a string representation of multiple substrings
     * @param {ExecutionContext} ecc
     * @param {string[] | object[]} list The list of items to consolidate
     * @param {boolean} [useOr] Use the word 'or' to construct the last sentence element
     * @param {boolean} [consolidate] Consolidate instances of the same string into one
     * @param {boolean} [useNumbers] Use digits instead of words to consolidate multiple instances
     * @returns {string} The consolidated string
     */
    arrayToSentence(ecc, list, useOr = false, consolidate = true, useNumbers = false) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'arrayToSentence', callType: CallOrigin.DriverEfun });
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
                    `${(useNumbers ? v.toString() : this.cardinal(frame.branch(), v))} ${(v > 1 ? this.pluralize(frame.branch(), k) : k)}`);
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
     * @param {ExecutionContext} ecc
     * @param {MUDObject} [target] Optional target object
     * @param {string} methodName The method to bind
     * @param {...any} args
     * @returns {function():any}
     */
    bindFunctionByName(ecc, target, methodName, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'bindFunctionByName', callType: CallOrigin.DriverEfun });
        try {
            //  First parameter was not an explicit MUD object; Use thisObject
            if (typeof target === 'string') {
                target = frame.context.thisObject;
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
        finally {
            frame.pop();
        }
    }

    /**
     * Attempt to create a regular expression from a file pattern
     * @param {ExecutionContext} ecc
     * @param {string} expr The string to convert
     * @param {boolean} exactMatch The pattern must match exactly
     */
    buildFilenamePattern(ecc, exprIn, exactMatchIn = true) {
        let [frame, expr, exactMatch] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'bindFunctionByName', callType: CallOrigin.DriverEfun });
        try {
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
        finally {
            frame?.pop();
        }
    }

    /**
     * Validate a password.
     * @param {ExecutionContext} ecc
     * @param {string} plain The plain text entered as a password.
     * @param {string} crypto The encrypted password to check against.
     * @param {function=} callback Optional callback if operation is async.
     * @returns {boolean} True if the password matches false if not.
     */
    checkPassword(ecc, plain, crypto, callback) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'checkPassword', callType: CallOrigin.DriverEfun });
        try {
            return driver.config.mud.passwordPolicy.checkPassword(plain, crypto, callback);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Retrieve client capabilities.
     * @param {ExecutionContext} ecc
     * @param {MUDObject|MUDWrapper} target The object to retrieve caps for.
     * @returns {{ clientHeight: number, clientWidth: number, colorEnabled: boolean, htmlEnabled: boolean, soundEnabled: boolean }} Client capabilities.
     */
    clientCaps(ecc, target) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'clientCaps', callType: CallOrigin.DriverEfun });
        try {
            let store = false;

            if (!target) {
                store = driver.storage.get(frame.context.getThisPlayer());
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
        finally {
            frame.pop();
        }
    }

    /**
     * Clone an existing in-game object.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} file The object to clone
     * @param {...any} args Constructor args
     * @returns {MUDWrapper} The object if successfully cloned.
     */
    async cloneObjectAsync(ecc, file, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'cloneObjectAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            return await driver
                .fileManager
                .cloneObjectAsync(frame.branch(), this.resolvePath(frame.context, file), args);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Render a list of words into columns of the specified width.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string|string[]} list A collection of words to format.
     * @param {number} width The maximum column width.
     * @param {MUDObject} [player] The optional player to format for.
     * @returns {string} A page of columns.
     */
    columnText(ecc, list, width, minSpacing = 2) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'columnText', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let rows = [],
                row = [],
                longest = 0,
                colCount = 0,
                colWidth = 0;

            if (typeof list === 'string') {
                list = list.split(/\s+/);
            }

            width = (width || this.env.COLUMNS || 80);

            list.forEach(i => {
                let n = this.stripColor(ecc, i).length;
                longest = n > longest ? n : longest;
            });
            colWidth = longest + minSpacing;
            colCount = Math.floor(width / colWidth);
            list.forEach((item, index) => {
                let s = item + Array(colWidth - this.stripColor(frame.branch(), item).length).join(' ');
                row.push(s);
                if ((index + 1) % colCount === 0) {
                    rows.push(row.join('').trim());
                    row = [];
                }
            });
            if (row.length > 0) rows.push(row.join(''));
            return rows.join(this.eol);
        }
        finally {
            frame.pop();
        }
    }


    /**
     * Force the previous object to perform an in-game object.
     * @param {ExecutionContext} ecc
     * @param {string} input The complete command to execute.
     */
    async command(ecc, input, isForced = false) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'command', isAsync: true, callType: CallOrigin.DriverEfun });

        try {
            let truePlayer = isForced && this.thisPlayer(ecc, true),
                thisObject = this.thisObject(ecc);

            if (!this.living.isAlive(ecc, thisObject))
                throw new Error(`${thisObject.fullPath} is not alive and cannot execute commands`);

            let words = input.split(/(\s+)/g),
                evt = {
                    verb: words.shift(),
                    text: words.join('').trim(),
                    args: words.filter(s => s.trim().length > 0)
                };
            await frame.context.withPlayerAsync(thisObject, async player => {
                await player.executeCommand(frame.branch(), evt);
            }, true, 'command');
        }
        finally {
            frame.pop();
        }
    }

    get console() {
        let ecc = ExecutionContext.getCurrentExecution();
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
        let ecc = ExecutionContext.getCurrentExecution();
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
        let ecc = ExecutionContext.getCurrentExecution(),
            cmd = ecc.command;

        if (cmd)
            return cmd.verb;
        else
            return '';
    }

    /**
     * Return the complete inventory of an object, including contained objects.
     * TODO: Make Async
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {MUDObject} target The target to scan
     * @returns {MUDObject[]} Returns the deep inventory.
     */
    deepInventory(ecc, target) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'deepInventory', callType: CallOrigin.DriverEfun });
        try {
            if (target.instance) {
                let result = target.instance.inventory;

                for (const item of result) {
                    let inv = this.deepInventory(frame.context, item);
                    if (inv.length > 0)
                        result.push(...inv);
                }
                return result;
            }
            return [];
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Remove an object from the game and (hopefully) allow it to be garbage-
     * collected on the next gc run.  This requires that there are no objects
     * referencing it.
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {MUDObject} target The object to destruct.
     */
    destruct(ecc, target, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'destruct', callType: CallOrigin.DriverEfun });
        try {
            let ob = target ? target.instance : frame.context.thisObject;
            if (ob) {
                let store = driver.storage.get(ob);
                if (store) {
                    if (frame.context.guarded(frame => driver.validDestruct(frame, ob))) {
                        return store.eventDestroy(frame.context, ...args);
                    }
                    else
                        throw Error(`Permission denied: Could not destruct object ${ob.filename}`);
                }
            }
            return false;
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Gets the directory name from an object instance.
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {MUDWrapper} target The MUD object.
     */
    directoryName(ecc, target) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'directoryName', callType: CallOrigin.DriverEfun });
        try {
            let dir = typeof target === 'object' && unwrap(target, o => o.filename) || target;
            return typeof dir === 'string' && dir.slice(0, dir.lastIndexOf('/'));
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Switch an interactive object's body instance.
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {MUDObject} ptrOld The body that is being left behind.
     * @param {MUDObject} ptrNew The body that the user is switching into.
     * @param {function(MUDObject,MUDObject):any} callback The callback to execute when the switch is complete.
     * @returns {boolean} True if the 
     */
    async exec(ecc, ptrOld, ptrNew, callback) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'exec', callType: CallOrigin.DriverEfun });
        try {
            let oldBody = ptrOld.isWrapper ? ptrOld() : ptrOld;
            let newBody = ptrNew.isWrapper ? ptrNew() : ptrNew;

            if (!frame.context.guarded(f => driver.validExec(f, oldBody, newBody)))
                throw new Error('Permission denied to efuns.exec()');

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
                await newStorage.eventExec(frame.context, component);
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
                    this.writeLine(frame.context, 'Sorry things did not work out.');
                    await component.disconnect(frame.context);
                }
                throw e;
            }
        }
        finally {
            frame.pop();
        }
    }

    get config() {
        return driver.config.createExport();
    }

    /**
     * Check to see if the string looks like a wildcard pattern
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {string} expr The expression to check
     * @returns {boolean} Returns true if the string looks like a file pattern
     */
    containsWildcard(ecc, expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'containsWildcard', callType: CallOrigin.DriverEfun });
        try {
            if (typeof expr !== 'string')
                return false;
            return /[\*\?\[\]]+/.test(expr);
        }
        finally {
            frame.pop();
        }
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

    get english() {
        return EnglishHelper;
    }

    get eol() {
        return '\n';
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
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {string} feature The name of the feature to check.
     * @returns {boolean} True if the feature is enabled or false if it does not exist or is disabled.
     */
    featureEnabled(ecc, feature) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'featureEnabled', callType: CallOrigin.DriverEfun });
        try {
            let result = driver.config.readValue(`driver.featureFlags.${feature}`, false);
            return result === true;
        }
        finally {
            frame.pop();
        }
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
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {number} n A number of bytes
     * @param {number} decim Number of decimal places
     * @returns {string} A human-friendly string.
     */
    getMemSizeString(ecc, n, decim = 0) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getMemSizeString', callType: CallOrigin.DriverEfun });
        try {
            let numeric = parseInt(n);

            if (isNaN(numeric))
                return n;

            if (decim > 0)
                decim = -decim;
            if (numeric > TeraByte) {
                return this.math.round10(frame.context, numeric / TeraByte, decim) + 'TB';
            }
            else if (numeric > GigaByte) {
                return this.math.round10(frame.context, numeric / GigaByte, decim) + 'GB';
            }
            else if (numeric > MegaByte) {
                return this.math.round10(frame.context, numeric / MegaByte, decim) + 'MB';
            }
            else if (numeric > KiloByte) {
                return this.math.round10(frame.context, numeric / KiloByte, decim) + 'KB';
            }
            else {
                return numeric.toString();
            }
        }
        finally {
            frame.pop();
        }
    }

    inherits(ecc, ob, targetType) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'inherits', callType: CallOrigin.DriverEfun });
        try {
            return global.MUDVTable.doesInherit(ob, targetType);
        }
        finally {
            frame.pop();
        }
    }

    get input() { return InputHelper; }

    /**
     * Determine if a function is async
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {any} expr
     * @returns
     */
    isAsync(ecc, expr) {
        let frame = ecc instanceof ExecutionContext ?
            ecc.pushFrameObject({ file: __filename, method: 'inherits', callType: CallOrigin.DriverEfun }) :
            false;

        try {
            if (!frame)
                expr = ecc;

            return typeof expr === 'function' && expr[Symbol.toStringTag] === 'AsyncFunction';
        }
        finally {
            if (frame)
                frame.pop();
        }
    }

    /**
     * Check to see if the current call has been awaited
     * @param {boolean} assertIfNotAwaited If true and the call is not awaited then a runtime exception is thrown
     * @returns {boolean}
     */
    isAwaited(assertIfNotAwaited = false, methodName = 'unknown') {
        let ecc = ExecutionContext.getCurrentExecution(),
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
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {any} o The value to check.
     * @returns {boolean} True if the value is a class reference.
     */
    isClass(ecc, o) {
        let [frame, ob] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isClass', callType: CallOrigin.DriverEfun });
        try {
            return typeof ob === 'function' && ob.toString().substring(0, 5) === 'class';
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Check to see if the current command is a result of external force
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @returns
     */
    isForced(ecc) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'isForced', callType: CallOrigin.DriverEfun });
        try {
            return ecc.truePlayer && ecc.thisPlayer !== ecc.truePlayer;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determine if an object is a Plain Old Object (POO)
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {any} target The item to inspect
     * @returns {boolean} True if the item is a plain old object.
     */
    isPOO(ecc, target) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'isPOO', callType: CallOrigin.DriverEfun });
        try {
            return typeof target === 'object' &&
                target.constructor.name === 'Object' &&
                target.constructor.constructor &&
                target.constructor.constructor.name === 'Function';
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determine if the target is a promise object.
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {any} item The item to check
     * @returns {boolean} Returns true if the item looks like an Promise object.
     */
    isPromise(ecc, item) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'isPromise', callType: CallOrigin.DriverEfun });
        try {
            if (typeof item === 'object') {
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
        finally {
            frame.pop();
        }
    }

    /**
     * Join path
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {...string} expr
     */
    joinPath(ecc, ...expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'joinPath', callType: CallOrigin.DriverEfun });
        try {
            return path.posix.join(...expr);
        }
        finally {
            frame.pop();
        }
    }

    /** The livings namespace */
    get living() { return LivingsHelper; }

    /**
     * Load an object
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {any} expr
     * @param {...any} args
     * @returns
     */
    async loadObjectAsync(ecc, expr, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'loadObjectAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            if (expr instanceof MUDObject)
                return expr;

            if (typeof expr !== 'string') {
                if (typeof expr === 'function' && expr.isWrapper)
                    return expr;
                else if (expr instanceof MUDObject)
                    return global.wrap(expr);
            }
            let result = await driver.fileManager.loadObjectAsync(frame.branch(), this.resolvePath(frame.context, expr), args);
            return result;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Attempts to find the specified object.  If not found then the object is compiled and returned.
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {string} expr The filename of the object to try and load.
     * @param {...any} args If the object is not found then these arguments are passed to the constructor.
     * @returns {MUDObject} The object (or false if object failed to load)
     * @deprecated
     */
    loadObjectSync(ecc, expr, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'loadObjectSync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            if (expr instanceof MUDObject)
                return expr;

            if (typeof expr !== 'string') {
                if (typeof expr === 'function' && expr.isWrapper)
                    return expr;
                else if (expr instanceof MUDObject)
                    return global.wrap(frame.context, expr);
            }
            return driver.fileManager.loadObjectSync(frame.context, this.resolvePath(frame.context, expr), args);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Writes content to a log file.
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {string} file The file to write to.
     * @param {string} message The message to write to
     * @returns {boolean} True on success.
     */
    async log(ecc, file, message) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'log', callType: CallOrigin.DriverEfun, isAsync: true });
        try {
            let logPath = path.posix.resolve(driver.config.mudlib.logDirectory, file),
                logFile = await driver.fileManager.getObjectAsync(frame.branch(), logPath);

            return await logFile.appendFileAsync(frame.branch(), message + this.eol);
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Log an error
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {Error} err
     */
    async logError(ecc, err) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'logError', callType: CallOrigin.DriverEfun, isAsync: true });
        try {
            let to = ecc.thisObject;
            return await driver.logError(frame.branch(), to.fullPath, err);
        }
        catch (e) {
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Send a message to one or more recipients.
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {string} messageType The message classification.
     * @param {string|MUDHtmlComponent|number|function} expr The message expression to display.
     * @param {MUDObject|MUDObject[]} audience One or more recipients to send the message to.
     * @param {MUDObject|MUDObject[]} excluded One or more objects to explicitly exclude from receiving the message.
     * @returns {true} Always returns true.
     */
    message(ecc, messageType, expr, audience, excluded) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'message', callType: CallOrigin.DriverEfun });
        try {
            if (expr) {
                if (!excluded)
                    excluded = [];

                if (!Array.isArray(excluded))
                    excluded = [excluded];

                if (!Array.isArray(audience)) {
                    audience = [audience || this.thisPlayer(frame.context)];
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
        finally {
            frame.pop();
        }
    }

    /**
     * Returns information about this MUD
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @returns
     */
    mudInfo(ecc) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'mudInfo', callType: CallOrigin.DriverEfun });
        try {
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
                mudMemoryTotal: this.getMemSizeString(frame.context, process.memoryUsage().heapTotal),
                mudMemoryUsed: this.getMemSizeString(frame.context, process.memoryUsage().heapUsed),
                name: driver.mudName,
                osbuild: os.type() + ' ' + os.release(),
                serverAddress: driver.serverAddress,
                systemMemoryUsed: this.getMemSizeString(frame.context, os.totalmem() - os.freemem()),
                systemMemoryPercentUsed: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100.0,
                systemMemoryTotal: this.getMemSizeString(frame.context, os.totalmem()),
                uptime: driver.uptime()
            };
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Returns the MUD's name
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @returns {string} The MUD name.
     */
    mudName(ecc) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'mudName', callType: CallOrigin.DriverEfun });
        try {
            return driver.config.mud.name;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Returns a normalized version of a character name.
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {string} name The name to normalize e.g. Bob the Builder
     * @param {boolean} flag If true, then the return value is in an array [name, wantsPlayer]
     * @returns {string} The normalized version of the name e.g. 'bobthebuilder'
     */
    normalizeName(ecc, name, flag = false) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'normalizeName', callType: CallOrigin.DriverEfun });
        try {
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
        finally {
            frame.pop();
        }
    }

    get objects() {
        return ObjectHelper;
    }

    /**
     * Determine the object type
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {any} arg
     * @returns {'function'|'string'|'number'|'MudObject'|'SimpleObject'|'boolean'|'undefined'|'object'|'array'} Returns the type of object
     */
    objectType(ecc, arg) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'objectType', callType: CallOrigin.DriverEfun });
        try {
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
        finally {
            frame.pop();
        }
    }

    /**
     * Return the origin of the current method
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @returns
     */
    origin(ecc) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'origin', callType: CallOrigin.DriverEfun });
        try {
            let previousFrame = frame.context.stack[1];
            return previousFrame ? previousFrame.origin : 0;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determines whether a value is a player or not.
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {any} target The value to check.
     * @returns {boolean} True if the value is a player or false.
     */
    playerp(ecc, target) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'playerp', callType: CallOrigin.DriverEfun });
        try {
            return this.living.isPlayer(ecc, target);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Splits a file/object name into it's components (path, type name, instance ID)
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {string} fileExprIn The file expression.
     * @returns {{ file: string, type: string, extension?: string, objectId: string, defaultType: boolean }} Information about the path.
     */
    parsePath(ecc, fileExprIn) {
        /** @type {[ ExecutionFrame, string ]} */
        let [frame, fileExpr] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'parsePath', callType: CallOrigin.DriverEfun });
        try {
            if (typeof fileExpr !== 'string' || fileExpr.length < 2)
                throw new Error('Bad argument 1 to parsePath');

            let ls = fileExpr.lastIndexOf('/'),
                ld = fileExpr.lastIndexOf('.'),
                ext = ld > -1 && ld > ls ? fileExpr.slice(ld) : false,
                n = ext && ext.indexOf('$');

            if (n !== false && n > -1)
                ext = ext.slice(0, n);

            let [path, objectId] = (fileExpr.startsWith('/') ? fileExpr : this.resolvePath(frame?.context, fileExpr)).split('#', 2),
                [file, type] = path.split('$', 2);

            if (!type || type.length === 0) {
                type = file.slice(file.lastIndexOf('/') + 1, ld === -1 ? undefined : ld);
            }
            if (!type)
                throw new Error(`Bad file expression: ${fileExpr}`);

            let defaultType = file.endsWith(`/${type}${ext}`);

            let result = Object.freeze({ file, type, extension: ext, objectId, defaultType });

            return result;
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Returns players in the game.  
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {boolean} showAll If optional flag is provided then link-dead players are also shown.
     * @returns {MUDObject[]} Player objects currently in the game.
     */
    players(ecc, showAll = false) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'players', callType: CallOrigin.DriverEfun });
        try {
            return driver.players.map(p => unwrap(p)).filter(player => {
                return player.connected || showAll;
            });
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Based on MudOS pluralize() + a few bug fixes.  Converts a string to the pluralized version.
     * Examples: child -> children, fox -> foxes.
     *
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {string} what The string to pluralize.
     * @returns {string} A pluralized form of the string.
     */
    pluralize(ecc, what) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'pluralize', callType: CallOrigin.DriverEfun });
        try {
            let result;

            if (typeof what !== 'string')
                throw new Error(`Bad argument 1 to pluralize(); Expected string|object got ${typeof what}`);

            var m = / of /i.exec(what);
            if (m && m.index > 0) {
                return this.pluralize(frame.context, what.slice(0, m.index)) + what.slice(m.index);
            }
            if (what.match(/a /i))
                return this.pluralize(frame.context, what.slice(2));
            else if (what.match(/an /i))
                return this.pluralize(frame.context, what.slice(3));

            if (what.indexOf(' ') > -1) {
                var lastIndex = what.lastIndexOf(' ');
                return what.slice(0, lastIndex + 1) + this.pluralize(frame.context, what.slice(lastIndex + 1));
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
        finally {
            frame.pop();
        }
    }

    /**
     * Determine if a particular object is present in the given inventory
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {any} id The id the target object must respond to
     * @param {any} env The environment in which to search
     * @param {any} returnAll If true, the return value will be all objects matching the id
     * @returns
     */
    present(ecc, id, env = false, returnAll = false) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'present', callType: CallOrigin.DriverEfun });
        try {
            if (!env) {
                env = this.thisObject(frame.context);
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
        finally {
            frame.pop();
        }
    }

    /**
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {number} n The number of objects to go back
     * @returns {MUDObject}
     */
    previousObject(ecc, n = 1) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'previousObject', callType: CallOrigin.DriverEfun });
        try {
            let prev = ecc.previousObject;
            return n === -1 ? prev.slice(0) : prev[n];
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Returns the current verb if a command is being executed.
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @returns {string} The verb currently being executed.
     */
    queryVerb(ecc) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'queryVerb', callType: CallOrigin.DriverEfun });
        try {
            return this.currentVerb || '';
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Import one or more required resources from another module.
     * @param {ExecutionContext} ecc The current execution context/call stack
     * @param {string} moduleName The module name to import.
     * @returns {any} The results of the import.
     */
    async requireAsync(ecc, moduleName) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'requireAsync', callType: CallOrigin.DriverEfun, isAsync: true });
        try {
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
                        let isInclude = moduleName.charAt(0) === '@',
                            filename = isInclude ?
                                await this.resolveIncludeAsync(frame.branch(), moduleName) :
                                await this.resolvePath(frame.branch(), moduleName, this.directoryName(frame.context, this.filename)),
                            module = driver.cache.get(filename);

                        if (!module)
                            module = await driver.compiler.compileObjectAsync(frame.branch(), {
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
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc
     * @param {string} moduleName
     * @param {any} specifiers
     * @param {any} relativePath
     */
    async importAsync(ecc, moduleName, specifiers, relativePath = false, lineNumber = 0) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'importAsync', callType: CallOrigin.DriverEfun, isAsync: true });
        try {
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
                                await this.resolveIncludeAsync(frame.branch(), moduleName) :
                                await this.resolvePath(frame.branch(), moduleName, relativePath || this.directoryName(frame.branch(), this.filename)),
                            module = driver.cache.get(filename);

                        if (!module)
                            module = await driver.compiler.compileObjectAsync(ecc, {
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
        finally {
            frame.pop(true);
        }
    }

    /**
     * Attempt to find an include file.
     * @param {ExecutionContext} ecc
     * @param {string} file The include file to locate.
     * @returns {string|false} Returns the path name of the file or false if not found.
     */
    async resolveIncludeAsync(ecc, file, ignoreCache) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'resolveIncludeAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let result = !ignoreCache && IncludeCache[file];
            let includePath = [this.directory || '/'];

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
                        let dir = await this.fs.getDirectoryAsync(frame.branch(), includePath[i]),
                            files = await dir.readDirectoryAsync(frame.branch(), file + '.*');

                        if (!Array.isArray(files)) {
                            files = await dir.readDirectoryAsync(frame.branch(), file + '.*');
                        }

                        if (files?.length === 1) {
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
        catch (err) {
            throw err;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Attempt to convert a partial MUD path into a fully-qualified MUD path.
     * TODO: Rewrite this ugly method to be more like path.resolve()
     * @param {ExecutionContext} ecc
     * @param {string} exprIn The expression to resolve.
     * @param {string} relativeToPathIn The relative directory to resolve from.
     * @returns {string} The resolved directory
     */
    resolvePath(ecc, exprIn, relativeToPathIn) {
        /** @type {[ExecutionFrame, string, boolean]} */
        let [frame, expr, relativeToPath] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'resolvePath', callType: CallOrigin.DriverEfun });
        try {
            relativeToPath = typeof relativeToPath === 'string' && relativeToPath || this.directory;

            if (typeof expr !== 'string')
                throw new Error(`Bad argument 1 to resolvePath; Expected string got ${(typeof expr)}`);

            if (expr.charAt(0) === '/')
                return expr;
            else if (expr.charAt(0) === '~') {
                let re = /^~([\\\/])*([^\\\/]+)/,
                    m = re.exec(expr) || [];

                if (m.length === 2) {
                    let homePath = this.user.getHomePath(frame.context, m[2]);
                    expr = homePath + expr.slice(m[2].length + 1);
                }
                else if (expr[1] === '/' || expr === '~') {
                    //  TODO: Call apply
                    let player = this.thisPlayer(frame.context);
                    expr = player ?
                        this.user.getHomePath(frame.context, player) + expr.slice(1) :
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
        catch (err) {
            throw err;
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Trigger a reset in an object regardless of schedule.
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} target
     */
    async resetObject(ecc, target = false) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'resetObject', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            if (!target) {
                target = this.thisObject(frame.context);
            }
            if (target) {
                let storage = driver.storage.get(target);
                if (storage)
                    await storage.eventReset();
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Restores the state of an object from file.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} pathOrObject The file to read properties from.
     */
    async restoreObjectAsync(ecc, pathOrObject) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'restoreObjectAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            if (this.objectType(frame.context, pathOrObject) === 'object' && '$type' in pathOrObject) {
                let $type = pathOrObject.$type;

                if (await frame.context.guarded(f => driver.validRead(f, $type))) {
                    let clone = await this.cloneObjectAsync(frame.branch(), $type),
                        store = driver.storage.get(clone);
                    return !!store && await store.eventRestore(frame.branch(), pathOrObject);
                }
                return false;
            }
            else {
                let ecc = frame.context,
                    thisOb = ecc.thisObject,
                    restoreFile = this.resolvePath(frame.context, pathOrObject, thisOb.directory);

                if (thisOb) {
                    if (!restoreFile.endsWith(SaveExtension))
                        restoreFile += SaveExtension;
                    let dataFile = await this.fs.getObjectAsync(frame.branch(), restoreFile);

                    if (dataFile.exists) {
                        let data = await dataFile.readJsonAsync(frame.branch());
                        let store = driver.storage.get(thisOb);
                        return store ? await store.eventRestore(frame.branch(), data) : false;
                    }
                }
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    get saveExtension() {
        return SaveExtension.slice(0);
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} expr The path to save to.
     */
    saveObject(ecc, expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'saveObject', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let ctx = ExecutionContext.getCurrentExecution(),
                prev = ctx.thisObject,
                parts = this.parsePath(frame.context, prev.filename);

            expr = expr || parts.file;

            if (prev) {
                if (!expr.endsWith(SaveExtension)) expr += SaveExtension;
                this.writeJsonFile(frame.context, expr, this.serialize(frame.context, prev));
                return true;
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Saves an object state to the specified file
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} expr The path to save to.
     * @param {string} [encoding] The encoding to use when serialize (defaults to utf8)
     */
    async saveObjectAsync(ecc, expr, encoding = 'utf8') {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'saveObjectAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let prev = frame.context.thisObject,
                parts = this.parsePath(frame.context, prev.filename),
                savePath = this.resolvePath(frame.context, expr || parts.file, prev.directory);

            if (prev) {
                if (!savePath.endsWith(SaveExtension))
                    savePath += SaveExtension;
                let data = this.serialize(frame.context, prev);
                return await this.fs.writeJsonAsync(frame.context, savePath, data, 0, encoding);
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    get security() {
        return SecurityHelper;
    }

    /**
     * Serialize an object for saving.
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} target
     */
    serialize(ecc, target) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'serialize', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let finalResult = unwrap(target, targetObject => {
                let serializeMudObject,
                    serializeSimpleObject,
                    serializeValue = (hive, key, val) => {
                        let vt = this.objectType(frame.context, val);

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
        finally {
            frame.pop();
        }
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
        let ecc = ExecutionContext.getCurrentExecution(),
            cmd = ecc.command;
        return cmd.env || {};
    }

    get err() {
        let ecc = ExecutionContext.getCurrentExecution(),
            cmd = ecc.command;
        if (cmd && cmd.stderr)
            return cmd.stderr;
        return ecc.shell && ecc.shell.console;
    }

    get in() {
        let ecc = ExecutionContext.getCurrentExecution(),
            cmd = ecc.command;
        if (cmd && cmd.stdin)
            return cmd.stdin;
        return false;
    }

    get objin() {
        let ecc = ExecutionContext.getCurrentExecution(),
            cmd = ecc.command;
        if (cmd && Array.isArray(cmd.objin))
            return cmd.objin;
        return false;
    }

    get out() {
        let ecc = ExecutionContext.getCurrentExecution(),
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

    /** 
     * Sets the default export for the module 
     * @param {ExecutionContext} ecc
     */
    async setDefaultExport(ecc, val) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'setDefaultExport', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let module = driver.cache.get(this.fullPath);
            return await module.setDefaultExport(frame.branch(), val, true);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Removes color codes from a string.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} str The string to remove color from.
     * @returns {string} The string minus any color encoding.
     */
    stripColor(ecc, str) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'stripColor', callType: CallOrigin.DriverEfun });
        try {
            return str.replace(/(\%\^[A-Z]+\%\^)/g, '');
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Shut the game down
     * @param {ExecutionContext} ecc The current callstack
     * @param {number} errCode The error code associated with the shutdown.
     * @param {string} reason The reason given for the shutdown.
     */
    async shutdown(ecc, errCode, reason) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'shutdown', callType: CallOrigin.DriverEfun, isAsync: true });
        try {
            if (await ecc.guarded(f => driver.validShutdown(f))) {
                process.exit(errCode || 0);
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * See sprintf package for details
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} args
     * @returns
     */
    sprintf(ecc, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'sprintf', callType: CallOrigin.DriverEfun, isAsync: false });
        try {
            return sprintf.apply(sprintf, args);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Strip Byte Order Mark (BOM)
     * @param {ExecutionContext} ecc The current callstack
     * @param {Buffer | string} content
     * @returns
     */
    stripBOM(ecc, content) {
        let frame = ecc instanceof ExecutionContext ? ecc.pushFrameObject({ file: __filename, method: 'stripBOM' }) : false;

        try {
            if (!frame)
                content = ecc;

            if (typeof content === 'string') {
                let byteInfo = Buffer.from(content.slice(0, 2));

                switch (byteInfo[0]) {
                    case 0xEF:
                        //  UTF8
                        if (byteInfo[1] === 0xBB && byteInfo[2] === 0xBF)
                            content = content.slice(1);
                        break;

                    case 0xFE:
                        //  Big Endian UTF-16
                        if (byteInfo[1] === 0xFF)
                            content = content.slice(1);
                        break;

                    case 0xFF:
                        //  Little Endian UTF-16
                        if (byteInfo[1] === 0xFE)
                            content = content.slice(1);
                }
            }
            else if (content.buffer && (content.buffer[0] === 0xFEFF || content.buffer[0] === 0xFFFE))
                content = content.slice(1);
            else if (content.slice && content.slice(0, 3).join(',') === '239,187,191')
                content = content.slice(3);
            return content;
        }
        finally {
            if (frame)
                frame.pop();
        }
    }

    get text() {
        return TextHelper;
    }

    /**
     * Returns the upper-most object on the stack.
     * @param {ExecutionContext} ecc The current callstack
     * @returns {MUDObject|false} The last object to interact with the MUD or false if none.
     */
    thisObject(ecc) {
        let [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'thisObject', callType: CallOrigin.DriverEfun, isAsync: false }, true);
        try {
            return frame.context && frame.context.previousObjects[0];
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Return the current player
     * @param {ExecutionContext} ecc The current callstack
     * @param {boolean} flagIn Show true player
     * @returns
     */
    thisPlayer(ecc, flagIn = false, getBoth = false) {
        let [frame, flag] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'thisPlayer', callType: CallOrigin.DriverEfun, isAsync: false }, true);
        try {
            if (!ecc) {
                console.log('\t\t\tefuns.thisPlayer() did not receive a context');
            }
            return frame.context.getThisPlayer(!!flag, getBoth)
        }
        finally {
            frame?.pop();
        }
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
     * @param {ExecutionContext} ecc The current callstack
     * @param {function} callback The code to execute in unguarded mode.
     * @returns {any} The result of the unguarded call.
     */
    async unguarded(ecc, callback) {
        let isAsync = this.isAsync(ecc, callback),
            frame = ecc.pushFrameObject({ file: __filename, method: 'unguarded', callType: CallOrigin.DriverEfun, isAsync, unguarded: true });
        try {
            if (typeof callback !== 'function')
                throw new Error(`Bad argument 1 to unguarded; expected function got ${typeof callback}`);
            if (isAsync)
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

    /**
     * Check if the specified object is a user
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} target
     * @returns
     */
    userp(ecc, target) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'userp', callType: CallOrigin.DriverEfun });
        try {
            return this.living.isInteractive(frame.context, target);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Checks to see if a given password complies with the MUD password policy.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} str A plain text password.
     * @returns {boolean} True if the password complies with the policy or false if too weak.
     */
    validPassword(ecc, str) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validPassword', callType: CallOrigin.DriverEfun });
        try {
            return driver.config.mud.passwordPolicy.validPassword(str);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determine if the given object is a wizard or not.
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} target
     */
    wizardp(ecc, target) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'wizardp', callType: CallOrigin.DriverEfun });
        try {
            return this.living.isWizard(frame.context, target);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Wrap text to the desired, maximum width
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} text The text to wrap
     * @param {number} maxLength
     * @param {string} indent
     */
    wrapText(ecc, text, maxLength, lineBreak, indent) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'wrapText', callType: CallOrigin.DriverEfun });
        try {
            text = text.replace(/[\r\n]+/g, ' ');
            maxLength = maxLength || this.env.COLUMNS || 80;

            if (typeof maxLength === 'function')
                maxLength = maxLength();

            let wordsAndSpace = text.split(/(\s+)/g),
                line = '',
                lineLength = 0,
                lines = [];

            for (const chunk of wordsAndSpace) {
                let clen = this.stripColor(frame.context, chunk).length;

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
        finally {
            frame.pop();
        }
    }

    /**
     * Write to STDERR
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} expr
     * @returns
     */
    error(ecc, ...expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'error', callType: CallOrigin.DriverEfun });
        try {
            let cmd = ecc.command,
                ec = cmd?.env?.ERRORCOLOR;

            if (ec) {
                expr = expr.map(s => '%^BOLD%^%^' + ec + '%^' + s + '%^RESET%^');
            }
            this.writeToStream(frame.context, false, this.err, ...expr);
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Write to STDERR
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} expr
     * @returns
     */
    errorLine(ecc, ...expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'errorLine', callType: CallOrigin.DriverEfun });
        try {
            let cmd = ecc.command,
                ec = cmd?.env?.ERRORCOLOR;

            if (ec) {
                expr = expr.map(s => '%^BOLD%^%^' + ec + '%^' + s + '%^RESET%^');
            }

            this.writeToStream(frame.context, true, this.err, ...expr);
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Write to STDOUT
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} expr
     * @returns
     */
    write(ecc, ...expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'write', callType: CallOrigin.DriverEfun });
        try {
            return this.writeToStream(frame.context, false, this.out, ...expr);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} expr
     * @returns
     */
    writeLine(ecc, ...expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'wrapText', callType: CallOrigin.DriverEfun });
        try {
            return this.writeToStream(frame.context, true, this.out, ...expr);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Write a message to the current player's screen.
     * @param {ExecutionContext} ecc The current callstack
     * @param {boolean} appendNewline If true then a newline is automatically appended at the end 
     * @param {...any} expr The expression to display.
     * @returns {true} Always returns true.
     */
    writeToStream(ecc, appendNewline = true, stream = false, ...expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'wrapText', callType: CallOrigin.DriverEfun });
        try {
            stream = stream || this.out;

            if (!stream)
                return false;
            else {
                let expandValue = /** @returns {string[]} */ item => {
                    let valType = typeof item;

                    if (valType === 'string')
                        return [item];
                    else if (item instanceof Buffer) {
                        return [item.toString('utf8')];
                    }
                    else if (valType === 'function') {
                        return expandValue(valType());
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
                    if (!this.text.trailingNewline(frame.context, content))
                        content += this.eol;
                }

                if (stream)
                    stream.write(content);

                return true;
            }
        }
        finally {
            frame.pop();
        }
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

