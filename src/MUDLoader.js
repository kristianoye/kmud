/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDObject = require('./MUDObject'),
    MUDHtml = require('./MUDHtml'),
    { TimeoutError } = require('./ErrorTypes'),
    { ExecutionContext, CallOrigin } = require('./ExecutionContext'),
    { SecurityError } = require('./ErrorTypes'),
    loopsPerAssert = 10000;

var /** @type {Object.<number,ExecutionContext>} */
    Intervals = {};
var /** @type {Object.<number,ExecutionContext>} */
    Callouts = {};

class MUDLoader {
    /**
     * @param {MUDCompiler} compiler The compiler.
     */
    constructor(compiler) {
        let _loopCounter = loopsPerAssert;
        this.console = console;

        // Prepare system namespace
        global.system = {};

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
            __asi: {
                //  Is Safe Index (asi)
                value: function (ind, filename, lineNumber) {
                    if (typeof ind === 'string') {
                        if (ind === 'call' || ind === 'apply' || ind === 'bind') {
                            throw new SecurityError(`Illegal attempt to invoke '${ind}' in ${filename} [Line ${lineNumber}]`);
                        }
                    }
                    return ind;
                },
                enumerable: false,
                writable: false
            },
            __bfc: {
                //  Begin Function Call
                value: function (ob, access, method, fileName, isAsync, lineNumber, type, callType) {
                    let ecc = driver.getExecution(),
                        newContext = false;

                    if (method.length === 0) {
                        method = '(MAIN)';
                    }

                    if (isAsync === false && method.startsWith('async '))
                        isAsync = true;

                    if (driver.efuns.isClass(type) && typeof ob === 'object' && ob instanceof type === false) {
                        throw new SecurityError(`Illegal invocation of '${method}' in ${filename} [Line ${lineNumber}]; Callee type mismatch`)
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
                            .push(ob instanceof MUDObject && ob, method || '(undefined)', fileName, isAsync, lineNumber, undefined, false, callType);
                    }
                    access && access !== "public" && ecc.assertAccess(ob, access, method, fileName);
                    //  Check access prior to pushing the new frame to the stack
                    if (access && !newContext)
                        return ecc
                            .alarm()
                            //  Previously only allowed objects inheriting from MUDObject to be allowed on stack
                            .push(/* ob instanceof MUDObject && */ ob, method || '(undefined)', fileName, isAsync, lineNumber, undefined, false, callType);

                    return ecc;
                },                enumerable: false,
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
            __pcc: {
                //  Perform Constructor Call -- Only used by built-in types
                value: function (thisObject, type, file, method, con, lineNumber) {
                    let ecc = driver.getExecution(thisObject, 'constructor', file, false, lineNumber);

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
                        module.eventResetModule();
                    }
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
                    if (module) {
                        module.eventDefineType(type);
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
            driver: {
                get: () => {
                    if (driver.gameState && driver.gameState > 2)
                        return undefined;
                    return driver;
                },
                enumerable: false
            },
            eval: {
                value: (code) => {
                    throw new Error('eval() is obsolete; Use evalAsync() instead');
                },
                writable: false
            },
            evalAsync: {
                value: async (code) => {
                    let source = await compiler.evalAsync(code),
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
                value: global.MUDObject,
                writable: false
            },
            MUDMixin: {
                value: global.MUDMixin,
                writable: false
            },
            pluralize: {
                value: function (...args) {
                    return _efuns.pluralize(...args);
                },
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

    /**
     * Extends a class using functionality from another type (pseudo-mixin)
     * @param {function} target The target type to extend.
     * @param {...string} moduleList The module that contains the extension
     * 
     */
    extendType(target, ...moduleList) {
        try {
            for (const exp of moduleList) {
                if (driver.efuns.isClass(exp)) {
                    global.MUDVTable.extendType(target, exp);
                }
                else
                    throw new Error(`Bad argument to extendType: ${exp}`)
            }
        }
        catch (err) {
            console.log(err);
            throw err;
        }
    }


    async createAsync(callingFile, type, ...args) {
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
    }

    createEfuns() {
        let ctx = driver.getExecution(),
            fn = ctx.currentFileName;
        return driver.createEfunInstance(fn);
    }

    /**
     * Remove an interval
     * @param {number} timer
     * @returns {boolean}
     */
    clearInterval(ident) {
        if (typeof ident === 'number' && ident > 0) {
            if (ident in Intervals) {
                let ctx = Intervals[ident],
                    varId = `setInterval-${ident}`,
                    frameId = ctx.getCustomVariable(varId);
                    
                ctx.removeFrameById(frameId);
                ctx.removeCustomVariable(varId);
            }
            global.clearInterval(ident);
            return true;
        }
        return false;
    }

    /**
     * Remove an timeout/callout
     * @param {number} timer The unique timer ID
     * @returns {boolean}
     */
    clearTimeout(ident) {
        if (typeof ident === 'number' && ident > 0) {
            if (ident in Callouts) {
                let ctx = Callouts[ident],
                    varId = `setTimeout-${ident}`,
                    frameId = ctx.getCustomVariable(varId);

                ctx.removeFrameById(frameId);
                ctx.removeCustomVariable(varId);
            }
            global.clearTimeout(ident);
            return true;
        }
        return false;
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
     * Attempt to destruct an object
     * @param {any} target
     * @param {...any} args
     * @returns
     */
    destruct(target, ...args) {
        return efuns.destruct(target, ...args);
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

    get system() {
        return global.system;
    }

    inc(usingType, file, key, value = 0, access = 2) {
        let store = driver.storage.get(this);
        store.set(this, usingType, file, key, value, access | 128, false);
    }

    /**
     * Check to see if the current call has been awaited
     * @param {boolean} assertIfNotAwaited If true and the call is not awaited then a runtime exception is thrown
     * @param {string} methodName The name of the async method being called
     * @returns {boolean}
     */
    isAwaited(assertIfNotAwaited = false, methodName = 'unknown') {
        return efuns.isAwaited(assertIfNotAwaited, methodName);
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

    origin(...args) {
        return efuns.origin(...args);
    }

    previousObject(n) {
        return efuns.previousObject(n);
    }

    /**
     * Capture the next line of user input
     * @param {string} type The type of control to create
     * @param {Object.<string,string>} options Additional options used to render the prompt
     * @param {function(string):void} callback A callback that will receive the user's input
     */
    prompt(type, options = {}, callback = false) {
        efuns.input.prompt(type, options, callback);
    }

    promptAsync(type, options = {}) {
        return efuns.input.promptAsync(type, options);
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

    /**
     * Allows us to unwind the Javascript stack without unwinding the MUD stack
     * @param {any} callback
     */
    setImmediate(callback) {
        let ecc = driver.getExecution(),
            child = ecc.fork(),
            isAsync = efuns.isAsync(callback);

        global.setImmediate(async () => {
            child.restore();

            let frame = child.pushFrameObject({ method: 'setImmediate', isAsync });
            try
            {
                if (isAsync)
                    await callback();
                else
                    callback();
            }
            finally {
                frame.pop();
            }
        });
    }

    /**
     * Periodically call a function
     * @param {function} callback The function to execute after the timer has expired
     * @param {number} timer The amount of time to delay execution (in ms)
     * @param {...any} args Additional parameters to pass to callback
     * @returns {number} Returns the unique ID/handle for the timer
     */
    setInterval(callback, timer, ...args) {
        //  TODO: Make this configurable
        if (timer < 50)
            throw new Error('Interval cannot be less than 50ms');

        //  Fork execution
        let /** @type {ExecutionContext} */ ecc = driver.getExecution(),
            childContext = ecc.fork(),
            thisObject = ecc.thisObject;

        //  Push this frame onto the stack as a placeholder
        let frame = childContext.pushFrameObject({ object: thisObject, method: 'setInterval', callType: CallOrigin.Callout });

        let ident = global.setInterval(async () => {
            //  Make this context the active one
            childContext.restore();

            //  Check for the health of this timer
            let hasError = false;

            try {
                if (efuns.isAsync(callback))
                    await callback.apply(thisObject, args);
                else
                    callback.apply(thisObject, args);
            }
            catch (err) {
                logger.log('Error in setInterval() callback; Disabling.');
                hasError = true;
            }
            finally {
                if (hasError === true)
                    this.clearInterval(typeof ident === 'number' ? ident : ident[Symbol.toPrimitive]());
            }
        }, timer);

        let timerId = typeof ident === 'number' ? ident : ident[Symbol.toPrimitive]();
        Intervals[ident] = childContext.addCustomVariable(`setInterval-${timerId}`, frame.id);
        return timerId;
    }

    /**
     * Call a function after the specified time has past
     * @param {function} callback The function to execute after the timer has expired
     * @param {number} timer The amount of time to delay execution (in ms)
     * @param {...any} args Additional parameters to pass to callback
     * @returns {number} Returns the unique ID/handle for the timer
     */
    setTimeout(callback, timer, ...args) {
        //  TODO: Make this configurable
        if (timer < 50)
            throw new Error('Interval cannot be less than 50ms');

        //  Fork execution
        let /** @type {ExecutionContext} */ ecc = driver.getExecution(),
            childContext = ecc.fork(),
            thisObject = ecc.thisObject;

        //  Push this frame onto the stack as a placeholder
        let frame = childContext.pushFrameObject({ object: thisObject, method: 'setTimeout', callType: CallOrigin.Callout });

        let ident = global.setTimeout(async () => {
            //  Make this context the active one
            childContext.restore();

            try {
                if (efuns.isAsync(callback))
                    await callback.apply(thisObject, args);
                else
                    callback.apply(thisObject, args);
            }
            catch (err) {
                hasError = true;
            }
            finally {
                frame.pop();
            }
        }, timer);

        let timerId = typeof ident === 'number' ? ident : ident[Symbol.toPrimitive]();
        Intervals[ident] = childContext.addCustomVariable(`setTimeout-${timerId}`, frame.id);
        return timerId;
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
