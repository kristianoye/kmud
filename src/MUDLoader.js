/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDObject = require('./MUDObject'),
    MUDHtml = require('./MUDHtml'),
    ExecutionContext = require('./ExecutionContext'),
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

class MUDLoader {
    /**
     * @param {MUDCompiler} compiler The compiler.
     */
    constructor(compiler) {
        let _loopCounter = loopsPerAssert;
        this.console = console;

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
                    let mec = driver.getExecution(), newContext = false;

                    if (method.length === 0) {
                        method = '(MAIN)';
                    }

                    if (!mec) {
                        if (!ob)
                            throw new Error('What, no execution context?!');
                        mec = driver.getExecution(ob, method, fileName, isAsync, lineNumber);
                        newContext = true;
                    }
                    else if (!access) {
                        //  This is (or should be) an arrow function so the stack needs
                        //  to be incremented prior to checking method access
                        mec
                            .alarm()
                            .push(ob instanceof MUDObject && ob, method || '(undefined)', fileName, isAsync);
                    }
                    access && access !== "public" && mec.assertAccess(ob, access, method, fileName);
                    if (false) {
                        //  Optional security check to prevent non-driver calls to driver applies
                        if (method && DriverApplies.indexOf(method) > -1) {
                            if (!mec.isValidApplyCall(method, ob))
                                throw new Error(`Illegal call to driver apply '${method}'`);
                        }
                    }
                    //  Check access prior to pushing the new frame to the stack
                    if (access && !newContext)
                        return mec
                            .alarm()
                            //  Previously only allowed objects inheriting from MUDObject to be allowed on stack
                            .push(/* ob instanceof MUDObject && */ ob, method || '(undefined)', fileName, isAsync);

                    return mec;
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
                //  Perform Constructor Call
                value: function (thisObject, type, file, method, con) {
                    let ecc = driver.getExecution(thisObject, 'constructor', file, false);
                    try {
                        let result = undefined, 
                            fn = type.prototype && type.prototype.baseName,
                            parts = fn && driver.efuns.parsePath(fn),
                            constructorType = typeof type === 'function' && type,
                            instanceData = false,
                            module = false;

                        if (!parts && !constructorType) {
                            if (typeof type === 'string')
                                parts = driver.efuns.parsePath(type);
                            else
                                throw new Error(`Unable to construct object from expression ${type}`);
                        }
                        if (parts) {
                            module = driver.cache.get(parts.file);

                            if (module) {
                                instanceData = ecc.newContext = Object.assign(
                                    module.getNewContext(parts.type),
                                    ecc.newContext);

                                if (!constructorType)
                                    constructorType = module.getType(parts.type);
                            }
                            if (ecc.newContext.isVirtual)
                                ecc.virtualParents.push(module);
                        }
                        if (!constructorType) {
                            throw new Error(`Unable to load module for expression ${type}`);
                        }
                        if (instanceData) {
                            result = module.create(constructorType, instanceData, instanceData.args, con);
                        }
                        else
                            result = con(constructorType);

                        return result;
                    }
                    finally {
                        delete ecc.newContext;
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
            eval: {
                value: (code) => {
                    let source = compiler.preprocess(code),
                        maxEvalTime = driver.config.driver.maxEvalTime || 10000;
                    return vm.runInContext(source, this, {
                        filename: 'eval',
                        displayErrors: true,
                        timeout: maxEvalTime
                    });
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
            },
        });
    }

    createEfuns() {
        let ctx = driver.getExecution(), fn = ctx.currentFileName;
        return driver.createEfunInstance(fn);
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

        if (store) {
            return store.eventSend(event);
        }
        return false;
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

    get(usingType, file, key, defaultValue = undefined, access = 2) {
        let store = driver.storage.get(this),
            result = store.get(this, usingType, file, key, defaultValue, access);
        return typeof result === 'undefined' ? defaultValue : result;
    }

    inc(usingType, file, key, value = 0, access = 2) {
        let store = driver.storage.get(this);
        store.set(this, usingType, file, key, value, access | 128, false);
    }

    /**
     * Registers a new value but only if not already defined.
     * @param {any} usingType The module attempting to set the value
     * @param {any} key The name of the variable to create
     * @param {any} val The initial value of the variable
     * @param {any} access The level access required to set/read the key
     * @returns {MUDObject} A reference to this object.
     */
    register(usingType, file, key, val, access = 2) {
        let store = driver.storage.get(this);
        if (efuns.isPOO(key)) {
            Object.keys(key).forEach(prop => {
                store.set(this, usingType, file, prop, key[prop], access, true);
            });
            return;
        }
        store.set(this, usingType, file, key, val, access, true);

    }

    /**
     * Sets a value (and creates if needed).
     * @param {any} usingType The module attempting to set the value
     * @param {any} key The name of the variable to create
     * @param {any} val The initial value of the variable
     * @param {any} access The level access required to set/read the key
     * @returns {MUDObject} A reference to this object.
     */
    set(usingType, file, key, val, access = 2) {
        let store = driver.storage.get(this);
        store.set(this, usingType, file, key, val, access, false);
    }

    clearInterval(ident) {
        return global.clearInterval(ident);
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
    `.trim();
}
/**
 * Configure the loader for runtime.
 * @param {GameServer} driver A reference to the game driver.
 */
MUDLoader.configureForRuntime = function (driver) {
    mudglobal.modifyLoader(MUDLoader.prototype);
};

module.exports = MUDLoader;
