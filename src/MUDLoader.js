/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDObject = require('./MUDObject'),
    MUDHtml = require('./MUDHtml'),
    { TimeoutError } = require('./ErrorTypes'),
    DriverApplies = [
        'connect',        // Called when a user connects with their body
        'create',         // Called and acts like a secondary constructor
        'destroy',        // Called when an object is destructed
        'disconnect',     // Called when a player disconnects from their body
        'heartbeat',      // Called periodically in "living" objects
        'init',           // Called when objects interact with one another
        'moveObject',     // Called to move the object from one location to another
        'prepareCommand', // Called while parsing command to override shell settings
        'processInput',   // Called to process user input
        'receiveMessage', // Called when an object receives a message
        'reset'           // Called periodically to reset the object state
    ],
    BaseInput = require('./inputs/BaseInput'),
    vm = require('vm'),
    loopsPerAssert = 10000;

if (typeof Promise.prototype.always !== 'function') {
    Promise.prototype.always = function (onResolveOrReject) {
        return this.then(onResolveOrReject, reason => {
            onResolveOrReject(reason);
            throw reason;
        });
    };
}

if (typeof global.Array.prototype.forEachAsync !== 'function') {
    global.Array.prototype.forEachAsync = async (callback) => {
        if (!driver.efuns.isAsync(callback))
            throw new Error('Bad argument 1 to forEachAsync(): Callback must be async');
        let promises = [];
        for (let i = 0; i < this.length; i++) {
            promises.push(callback(this[i], i));
        }
        return await Promise.all(promises);
    };
}

class MUDLoader {
    /**
     * @param {MUDCompiler} compiler The compiler.
     */
    constructor(compiler) {
        let _loopCounter = loopsPerAssert;
        this.console = console;

        console.log('MUDLoad.constructor');

        Object.defineProperties(this, {
            __cat: {
                // Assert Catch Type
                value: function (val) {
                    driver.cleanError(val, true);
                    // Catching timeout errors is not allowed
                    if (val instanceof TimeoutError) {
                        throw val;
                    }
                    driver.errorHandler(val, true);
                },
                enumerable: false,
                writable: false
            },
            __ala: {
                //  Assert Loop Alarm (ala)
                value: function () {
                    if (--_loopCounter === 0) {
                        let ecc = driver.executionContext;
                        ecc && ecc.alarm();
                    }
                },
                enumerable: false,
                writable: false
            },
            __bfc: {
                //  Begin Function Call
                value: function (ob, access, method, fileName, isAsync, lineNumber, type) {
                    let ecc = driver.getExecution(),
                        newContext = false;

                    if (method.length === 0) {
                        method = '(MAIN)';
                    }

                    if (!ecc) {
                        if (!ob) // Crasher?
                            throw new Error('What, no execution context?!');
                        ecc = driver.getExecution(ob, method, fileName, isAsync, lineNumber);
                        newContext = true;
                    }
                    else if (!access) {
                        //  This is (or should be) an arrow function so the stack needs
                        //  to be incremented prior to checking method access
                        ecc
                            .alarm()
                            .push(ob instanceof MUDObject && ob, method || '(undefined)', fileName, isAsync);
                    }
                    access && access !== "public" && ecc.assertAccess(ob, access, method, fileName);
                    if (false) {
                        //  Optional security check to prevent non-driver calls to driver applies
                        if (method && DriverApplies.indexOf(method) > -1) {
                            if (!ecc.isValidApplyCall(method, ob))
                                throw new Error(`Illegal call to driver apply '${method}'`);
                        }
                    }
                    //  Check access prior to pushing the new frame to the stack
                    if (access && !newContext)
                        return ecc
                            .alarm()
                            //  Previously only allowed objects inheriting from MUDObject to be allowed on stack
                            .push(/* ob instanceof MUDObject && */ ob, method || '(undefined)', fileName, isAsync);

                    return ecc;
                },
                enumerable: false,
                writable: false
            },
            __efc: {
                // End Function Call
                value: function (/** @type {ExecutionContext} */ mec, methodOrFunc) {
                    mec && mec.pop(methodOrFunc);
                },
                enumerable: false,
                writable: false
            },
            __LINE__: {
                get: function () {
                    let foo = new Error('').stack.split('\n'), re = /((\d+):(\d+))/;
                    for (let i = 0, m = null, c = 0; i < foo.length; i++) {
                        if ((m = re.exec(foo[i])) && c++ === 1)
                            return parseInt(m[1]);
                    }
                }
            },
            __pcc: {
                //  Perform Constructor Call -- Only used by built-in types
                value: function (thisObject, type, file, method, con) {
                    let ecc = driver.getExecution(thisObject, 'constructor', file, false);

                    try {
                        if (type.prototype && type.prototype.baseName)
                            throw new Error(`Mudlib objects must be created with createAsync(...)`);
                        else
                            return con(type);
                    }
                    finally {
                        ecc.popCreationContext();
                        ecc && ecc.pop('constructor');
                    }
                    return result;
                },
                writable: false,
                enumerable: false
            },
            __rmt: {
                //  Reset Module Types
                value: function (fileName) {
                    let module = driver.cache.get(fileName);
                    if (module) {
                        module.resetModule();
                    }
                    module.typeNames = [];
                    module.types = {};

                    // You would THINK we could clear exports here, but no.
                    // module.exports = {};
                },
                writable: false,
                enumerable: false
            },
            __dmt: {
                //  Define Module Type
                value: function (fileName, type) {
                    let module = driver.cache.get(fileName);
                    module.types[type.name] = type;
                    module.typeNames.push(type.name);
                    if (typeof module.instanceMap[type.name] === 'undefined') {
                        module.instanceMap[type.name] = [];
                    }
                }
            },
            Array: {
                value: global.Array,
                writable: false
            },
            Buffer: {
                value: global.Buffer,
                writable: false
            },
            DEBUG: {
                value: Object.freeze({
                    LineNumberInTrace: false
                }),
                writable: false
            },
            createAsync: {
                value: async (callingFile, type, ...args) => {
                    if (typeof type === 'string') {
                        let parts = driver.efuns.parsePath(type),
                            module = driver.cache.get(parts.file);

                        if (!module) 
                            module = await driver.compiler.compileObjectAsync({ file, args });

                        if (module && module.isVirtual === true) 
                            return module.defaultExport;
                        else
                            return await driver.efuns.objects.cloneObjectAsync(type, ...args);
                    }
                    else if (type.prototype && typeof type.prototype.baseName === 'string') {
                        let parts = driver.efuns.parsePath(type.prototype.baseName),
                            ecc = driver.getExecution(callingFile, 'createAsync', parts.file, false),
                            module = driver.cache.get(parts.file);

                        try {
                            return await module.createInstanceAsync(parts.type, false, args, false, callingFile);
                        }
                        finally {
                            ecc && ecc.pop('createAsync');
                        }
                    }
                    else if (typeof type === 'function') {
                        return new type(...args);
                    }
                    else
                        throw new Error(`Bad argument 1 to createAsync(); Expected string or type but got ${typeof type}`);
                },
                writable: false
            },
            eval: {
                value: (code) => {
                    throw new Error('eval() is obsolete; Use evalAsync() instead');
                },
                writable: false
            },
            evalAsync: {
                value: async (code) => {
                    let source = compiler.preprocess(code),
                        maxEvalTime = driver.config.driver.maxEvalTime || 10000,
                        result = undefined;

                    try {
                        result = await driver.vm.runCodeAsync(source, this, {
                            filename: 'evalAsync',
                            displayErrors: true,
                            timeout: maxEvalTime
                        });
                    }
                    catch (err) {
                        throw err;
                    }

                    return result;
                },
                writable: false
            },
            logger: {
                value: global.logger,
                writable: false
            },
            master: {
                value: function () {
                    return driver.masterObject;
                }
            },
            mud_name: {
                value: function () {
                    return driver.config.mud.name;
                },
                writable: false
            },
            MUDEVENT_REMOVELISTENER: {
                value: global.MUDEVENT_REMOVELISTENER,
                writable: false
            },
            MUDEVENT_STOP: {
                value: global.MUDEVENT_STOP,
                writable: false
            },
            MUDHTMLComponent: {
                value: MUDHtml.MUDHTMLComponent,
                writable: false
            },
            MUDHtmlElement: {
                value: MUDHtml.MUDHtmlElement,
                writable: false
            },
            MUDObject: {
                value: MUDObject,
                writable: false
            },
            MUDMixin: {
                value: global.MUDMixin,
                writable: false
            },
            Object: {
                value: global.Object,
                writable: false
            },
            Promise: {
                value: global.Promise,
                writable: false
            },
            pluralize: {
                value: function (...args) {
                    return _efuns.pluralize(...args);
                },
                writable: false
            },
            setTimeout: {
                value: global.setTimeout,
                writable: false
            },
            PRIVATE: {
                value: 3,
                writable: false
            },
            PROTECTED: {
                value: 2,
                writeable: false
            },
            PACKAGE: {
                value: 1,
                writeable: false
            },
            PUBLIC: {
                value: 0,
                writeable: false
            }
        });
    }

    createEfuns() {
        let ctx = driver.getExecution(),
            fn = ctx.currentFileName;
        return driver.createEfunInstance(fn);
    }

    clearInterval(ident) {
        return global.clearInterval(ident);
    }

    createElement() {
        let children = [].slice.call(arguments),
            type = children.shift(),
            props = children.shift();
        if (typeof type === 'string') {
            return new MUDHtml.MUDHtmlElement(type, props, children);
        }
        else if (typeof type === 'function' && type.toString().match(/^class /)) {
            return new type(type, props, children);
        }
        else if (typeof type === 'function') {
            return new MUDHtml.MUDHtmlComponent(type, props, children);
        }
    }

    /**
     * Write to standard error
     * @param {...any} args
     */
    error(...args) {
        return efuns.writeToStream(false, efuns.err, ...args);
    }

    errorLine(...args) {
        return efuns.writeToStream(true, efuns.err, ...args);
    }

    eventSend(event, target = false) {
        let ecc = driver.getExecution(),
            thisObject = target || ecc.player,
            store = !!thisObject && driver.storage.get(thisObject);

        if (store && store.component) {
            return store.eventSend(Object.assign({ target: store.component.id }, event));
        }
        return false;
    }

    /**
     * Sets a value (and creates if needed).
     * @param {any} definingType The class reference attempting to set the value
     * @param {propertyName} value The name of the variable to create
     * @param {any} initialValue The initial value if the property is not defined
     * @returns {any} Returns the value on success
     */
    get(definingType, propertyName, initialValue) {
        let store = driver.storage.get(this);
        return !!store && store.get(definingType, propertyName, initialValue);
    }

    inc(usingType, file, key, value = 0, access = 2) {
        let store = driver.storage.get(this);
        store.set(this, usingType, file, key, value, access | 128, false);
    }

    /**
     * Send a message to one or more objects.
     * @param {any} messageType
     * @param {any} expr
     * @param {any} audience
     * @param {any} excluded
     */
    message(messageType='', expr='', audience=[], excluded=[]) {
        return efuns.message(messageType, expr, audience, excluded);
    }

    get MUDFS() {
        return Object.assign({}, global.MUDFS);
    }

    /**
     * Capture the next line of user input
     * @param {string} type The type of control to create
     * @param {Object.<string,string>} options Additional options used to render the prompt
     * @param {function(string):void} callback A callback that will receive the user's input
     */
    prompt(type, options = {}, callback = false) {
        if (typeof options === 'string') {
            options = { text: options };
        }
        if (typeof type === 'string') {
            if (!BaseInput.knownType(type)) {
                options = Object.assign({ text: type }, options);
                type = 'text';
            }
        }
        efuns.input.addPrompt(type, Object.assign({
            default: false,
            text: 'Prompt: ',
            type: 'text'
        }, options), callback);
    }

    /**
     * Sets a value (and creates if needed).
     * @param {any} definingType The class reference attempting to set the value
     * @param {propertyName} value The name of the variable to create
     * @param {any} value The actual value of the property
     * @returns {boolean} Returns true on success.
     */
    set(definingType, propertyName, value) {
        let key = this.filename;

        if (!key) {
            let ecc = driver.getExecution(),
                cct = ecc.newContext;
            key = cct && cct.filename;
            if (!key) return false;
        }
        let store = driver.storage.get(this, key);
        return store && store.set(definingType, propertyName, value);
    }

    setInterval(callback, timer) {
        if (timer < 1000)
            throw new Error('Interval cannot be less than 1000ms');

        //  Create a detached child
        let ecc = driver.getExecution(),
            child = !!ecc && ecc.fork(true),
            thisObject = ecc.thisObject;

        let ident = global.setInterval(function (callback, childContext) {
            try {
                childContext.restore();
                childContext.push(thisObject, 'setInterval', thisObject.filename);
                callback();
            }
            catch (err) {
                logger.log('Error in setInterval() callback; Disabling.');
                global.clearInterval(ident);
            }
            finally {
                childContext.pop('setInterval');
                childContext.suspend();
            }
        }, timer, callback, child);

        return ident;
    }

    thisPlayer(flag) {
        let ecc = driver.getExecution();

        return ecc ?
            flag ? ecc.truePlayer : ecc.player :
            false;
    }

    unwrap(...args) {
        return global.unwrap(...args);
    }

    units(units, unitType) {
        return driver.convertUnits(units, unitType);
    }

    wrapper(...args) { 
        return global.wrapper(...args);
    }

    write(...str) {
        efuns.writeToStream(false, efuns.stdout, ...str);
        return true;
    }

    writeLine(...str) {
        efuns.writeToStream(true, efuns.stdout, ...str);
        return true;
    }

    writeRaw(str) {
        return efuns.efuns.writeRaw(str);
    }
}

MUDLoader.getInitialization = function () {
    return `
    Promise.prototype.always = function (onResolveOrReject) {
        return this.then(onResolveOrReject, reason => {
            onResolveOrReject(reason);
            throw reason;
        });
    };

    String.notEmpty = function(s) {
        return typeof s === 'string' && /\\w+/.test(s);
    };
    `.trim();
}
/**
 * Configure the loader for runtime.
 * @param {GameServer} driver A reference to the game driver.
 */
MUDLoader.configureForRuntime = function (driver) {
    //mudglobal.modifyLoader(MUDLoader.prototype);
};

module.exports = MUDLoader;
