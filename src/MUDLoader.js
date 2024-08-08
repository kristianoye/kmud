/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDObject = require('./MUDObject'),
    SimpleObject = require('./SimpleObject'),
    MUDHtml = require('./MUDHtml'),
    { TimeoutError } = require('./ErrorTypes'),
    { ExecutionContext, CallOrigin } = require('./ExecutionContext'),
    { SecurityError } = require('./ErrorTypes'),
    loopsPerAssert = 10000,
    MemberModifiers = require("./compiler/MudscriptMemberModifiers"),
    UnitsOfMeasurement = Object.freeze({
        g: 1,
        Gram: 1,
        Grams: 1,
        Lb: 453.59237,
        Lbs: 453.59237,
        mg: 0.001,
        mgs: 0.001,
        Kg: 1000,
        Kgs: 1000,
        Ounce: 28.3495231,
        Ounces: 28.3495231,
        Pound: 453.59237,
        Pounds: 453.59237
    });

var /** @type {Object.<number,ExecutionContext>} */
    Intervals = {};
var /** @type {Object.<number,ExecutionContext>} */
    Callouts = {};

/**
 * @global {import('./EFUNProxy')} efuns */

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
                /**
                 * Catch a game error
                 * @param {ExecutionContext} ecc The current callstack
                 * @param {Error} val The error that occurred
                 */
                value: function (ecc, val) {
                    const
                        caller = ecc._callstack[0],
                        frame = ecc.push({ method: '__cat' });
                    try {
                        if (typeof val === 'string') {
                            const error = {
                                message: val,
                                lineNumber: caller.lineNumber,
                                fileName: caller.file,
                                stack: caller.context.getStackString(1)
                            };
                            driver.errorHandler(frame.context, ecc._callstack[1].error = error, true);
                        }
                        else {
                            // Catching timeout errors is not allowed
                            if (val instanceof TimeoutError) {
                                throw val;
                            }
                            driver.errorHandler(frame.context, ecc._callstack[1].error = val, true);
                        }
                    }
                    finally {
                        frame.pop();
                    }
                },
                configurable: false,
                enumerable: false,
                writable: false
            },
            __ala: {
                //  Assert Loop Alarm (ala)
                value: function () {
                    if (--_loopCounter <= 0) {
                        let ecc = driver.executionContext;
                        ecc && ecc.alarm();
                    }
                },
                configurable: false,
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
                configurable: false,
                enumerable: false,
                writable: false
            },
            __bfc: {
                /**
                 * Begin Function Call
                 * @param {ExecutionContext} ecc The current callstack
                 * @param {IArguments} parameters Raw arguments
                 * @param {[Object.<string, [function()] | [function(): any, function(val): void]>]} namedParameters The named parameters
                 * @param {typeof MUDObject} ob 
                 * @param {number} access 
                 * @param {string} method 
                 * @param {string} file 
                 * @param {boolean} isAsync 
                 * @param {number} lineNumber 
                 * @param {typeof MUDObject} type 
                 * @param {number} callType 
                 * @returns 
                 */
                value: function (ecc, parameters, namedParameters, ob, access, method, file, isAsync, lineNumber, type, callType) {
                    let args = Array.prototype.slice(parameters);
                    let newContext = false;

                    if (ecc instanceof ExecutionContext === false) {
                        throw new Error('Illegal function call');
                    }

                    if (ecc._callstack[0].neededContext === true && parameters.length !== namedParameters.length) {
                        const offset = parameters[0] instanceof ExecutionContext ? 1 : 0;
                        namedParameters.forEach((p, i) => {
                            for (const [varName, desc] of Object.entries(p)) {
                                desc[1](parameters[i + offset]);
                            }
                        });
                    }

                    //  Don't allow access to the execution context via arguments object
                    parameters[0] = undefined;

                    if (method.length === 0) {
                        method = '(MAIN)';
                    }

                    if (typeof access !== 'number') {
                        //  Crasher?
                        throw new Error(`Invalid access specifier; Expected number but got ${typeof access}`);
                    }

                    if (isAsync === false && method.startsWith('async '))
                        isAsync = true;

                    if (driver.efuns.isClass(ecc, type) && typeof ob === 'object' && MUDVTable.doesInherit(ob, type) === false) {
                        throw new SecurityError(`Illegal invocation of '${method}' in ${file} [Line ${lineNumber}]; Callee type mismatch`)
                    }

                    if (!ecc) {
                        driver.crashSync(new Error(`Method or function ${method} in ${file} called without a callstack`));
                    }
                    else if (!access) {
                        //  This is (or should be) an arrow function so the stack needs
                        //  to be incremented prior to checking method access
                        ecc
                            .alarm()
                            .push({
                                object: (ob instanceof MUDObject || ob instanceof SimpleObject) && ob,
                                method: method || '(anonymous)',
                                parameters: namedParameters,
                                file,
                                lineNumber,
                                isAsync,
                                callType
                            });
                    }

                    if ((access & MemberModifiers.Public) !== MemberModifiers.Public)
                        ecc.assertAccess(ob, access, method, file);

                    //  Check access prior to pushing the new frame to the stack
                    if (access && !newContext)
                        ecc.alarm()
                            .push({
                                object: (ob instanceof MUDObject || ob instanceof SimpleObject) && ob,
                                method: method || '(undefined)',
                                parameters: namedParameters,
                                file,
                                isAsync,
                                lineNumber,

                            })

                    return [ecc, args];
                },
                configurable: false,
                enumerable: false,
                writable: false
            },
            __efc: {
                // End Function Call
                value: function (/** @type {ExecutionContext} */ mec, methodOrFunc) {
                    mec && mec.pop(methodOrFunc);
                },
                configurable: false,
                enumerable: false,
                writable: false
            },
            __pcc: {
                //  Perform Constructor Call -- Only used by native NodeJS/non-game types
                /**
                 * 
                 * @param {ExecutionContext} ecc The current callstack
                 * @param {MUDObject} thisObject The current game object
                 * @param {function} type The type being constructed
                 * @param {string} file The calling file
                 * @param {string} method The calling method
                 * @param {function} con The constructor function
                 * @param {number} lineNumber The origin line within the file where the constructor was called
                 * @returns 
                 */
                value: function (ecc, thisObject, type, file, method, con, lineNumber) {
                    let frame = ecc.push({ object: thisObject, method: 'new', callType: CallOrigin.driver });
                    try {
                        if (type.prototype && type.prototype.baseName && type.prototype.baseName !== 'MUDObject' && type.prototype instanceof SimpleObject === false)
                            throw new Error(`Mudlib objects must be created with createAsync(...)`);
                        else
                            return con(type);
                    }
                    finally {
                        ecc.popCreationContext();
                        frame.pop();
                    }
                },
                configurable: false,
                writable: false,
                enumerable: false
            },
            __rmt: {
                /**
                 * Reset Module Types
                 * @param {ExecutionContext} ecc The current callstack
                 * @param {string} fileName
                 */
                value: function (ecc, fileName) {
                    let frame = ecc.push({ file: fileName, method: '__rmt' });
                    try {
                        let module = driver.cache.get(fileName);
                        if (module) {
                            module.eventResetModule(frame.branch());
                        }
                        // You would THINK we could clear exports here, but no.
                        // module.exports = {};
                    }
                    finally {
                        frame.pop();
                    }
                },
                configurable: false,
                writable: false,
                enumerable: false
            },
            __cef: {
                //  Create efuns
                value: function (handleId, filename) {
                    let ctx = ExecutionContext.getContextByHandleID(handleId),
                        newEfuns = driver.createEfunInstance(filename);
                    return [newEfuns, ctx];
                },
                configurable: false,
                enumerable: false,
                writable: false
            },
            __dmt: {
                /**
                 * Define Module Type
                 * @param {ExecutionContext} ecc
                 * @param {string} fileName
                 * @param {function} type
                 */
                value: function (ecc, fileName, type) {
                    let module = driver.cache.get(fileName);
                    if (module) {
                        module.eventDefineType(ecc, type);
                    }
                },
                configurable: false,
                writable: false,
                enumerable: false
            },
            __gec: {
                get: function () {
                    let current = ExecutionContext.current;
                    return current;
                },
                configurable: false,
                enumerable: false
            },
            __ifc: {
                /**
                 * Try and use the existing context from the stack
                 * @param {ExecutionContext} defaultContext The default context
                 * @param  {any[]} args 
                 */
                value: function (defaultContext, args) {
                    /** @type {[ ExecutionContext, any ]} */
                    let [ctx, ...parms] = args;
                    if (ctx instanceof ExecutionContext) {
                        return ctx;
                    }
                    else {
                        ctx = defaultContext instanceof ExecutionContext ? defaultContext : ExecutionContext.getCurrentExecution();
                        ctx._callstack[0].neededContext = true;
                        return ctx;
                    }
                },
                enumerable: false,
                configurable: false,
                writable: false
            },
            __igt: {
                value: function (proto, specificMethodList = false) {
                    return driver.instrumentObject(proto, specificMethodList);
                },
                enumerable: false,
                writable: false,
                configurable: false
            },
            __ivc: {
                value: true,
                enumerable: false,
                writable: false,
                configurable: false
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
            global: {
                get: function () {
                    return this;
                },
                enumerable: false,
                configurable: false
            },
            inherits: {
                value: function (ob, targetType) {
                    return global.MUDVTable.doesInherit(ob, targetType);
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
            },
            SimpleObject: {
                value: global.SimpleObject,
                writable: false
            }
        });
    }

    /**
     * Extends a class using functionality from another type (pseudo-mixin)
     * @param {ExecutionContext} ecc The current callstack
     * @param {function} target The target type to extend.
     * @param {...string} moduleList The module that contains the extension
     * 
     */
    extendType(ecc, target, ...moduleList) {
        let frame = ecc.push({ file: __filename, method: 'extendType' });
        try {
            for (const exp of moduleList) {
                if (driver.efuns.isClass(frame.context, exp)) {
                    global.MUDVTable.extendType(target, exp);
                }
                else
                    throw new Error(`Bad argument to extendType: ${exp}`)
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Create an instance of an object
     * @param {string} callingFile The file 
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} type
     * @param {...any} args
     * @returns
     */
    async createAsync(callingFile, ecc, type, ...args) {
        let frame = ecc.push({ file: callingFile, method: 'createAsync', isAsync: true, callType: CallOrigin.Constructor });
        try {
            if (typeof type === 'string') {
                let parts = driver.efuns.parsePath(frame.branch(), type),
                    module = driver.cache.get(parts.file);

                if (!module)
                    module = await driver.compiler.compileObjectAsync(frame.branch(), { file, args });

                if (module && module.isVirtual === true)
                    return module.defaultExport;
                else if (module === false)
                    return await driver.efuns.objects.cloneObjectAsync(frame.branch(), type, ...args);
                else {
                    return await module.createInstanceAsync(frame.branch(), parts, undefined, args, callingFile);
                }
            }
            else if (type.prototype && typeof type.prototype.baseName === 'string' && type.prototype.baseName !== 'MUDObject') {
                let parts = driver.efuns.parsePath(frame.branch(), type.prototype.baseName),
                    module = driver.cache.get(parts.file);

                return await module.createInstanceAsync(frame.branch(), parts.type, false, args, false, callingFile);
            }
            else if (typeof type === 'function') {
                return new type(...args);
            }
            else
                throw new Error(`Bad argument 1 to createAsync(); Expected string or type but got ${typeof type}`);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Remove an interval
     * @param {ExecutionContext} ecc The current callstack
     * @param {number} timer
     * @returns {boolean}
     */
    clearInterval(ecc, ident) {
        let frame = ecc.push({ method: 'clearInterval', callType: CallOrigin.Driver });
        try {
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
        finally {
            frame.pop();
        }
    }

    /**
     * Remove an timeout/callout
     * @param {ExecutionContext} ecc The current callstack
     * @param {number} timer The unique timer ID
     * @returns {boolean}
     */
    clearTimeout(ecc, ident) {
        let frame = ecc.push({ method: 'clearTimeout', callType: CallOrigin.Driver });
        try {
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
        finally {
            frame.pop();
        }
    }

    /**
     * Create an element (JSX)
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} children
     * @returns
     */
    createElement(ecc, ...children) {
        let frame = ecc.push({ method: 'createElement' });
        try {
            let type = children.shift(),
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
        finally {
            frame.pop();
        }
    }

    /**
     * Attempt to destruct an object
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} target
     * @param {...any} args
     * @returns
     */
    destruct(...args) {
        return driver.efuns.destruct(...args);
    }

    get ENV() { return driver.efuns.env; }

    /**
     * Write to standard error
     * @param {...any} args
     */
    error(...args) {
        return efuns.error(...args);
    }

    errorLine(...args) {
        return efuns.errorLine(...args);
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} event
     * @param {any} target
     * @returns
     */
    eventSend(ecc, event, target = false) {
        let frame = ecc.push({ method: 'eventSend', callType: CallOrigin.DriverEfun });
        try {
            let thisObject = target || ecc.player,
                store = !!thisObject && driver.storage.get(thisObject);

            if (store && store.component) {
                return store.eventSend(Object.assign({ target: store.component.id }, event));
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Sets a value (and creates if needed).
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} definingType The class reference attempting to set the value
     * @param {propertyName} value The name of the variable to create
     * @param {any} initialValue The initial value if the property is not defined
     * @returns {any} Returns the value on success
     */
    get(ecc, definingType, propertyName, initialValue) {
        const frame = ecc.push({ object: this, method: 'get', callType: CallOrigin.LocalCall });
        try {
            let store = driver.storage.get(this);
            return !!store && store.get(definingType, propertyName, initialValue);
        }
        finally {
            frame.pop();
        }
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
     * @param {ExecutionContext} ecc The current callstack
     * @param {boolean} assertIfNotAwaited If true and the call is not awaited then a runtime exception is thrown
     * @param {string} methodName The name of the async method being called
     * @returns {boolean}
     */
    isAwaited(ecc, assertIfNotAwaited = false, methodName = 'unknown') {
        return efuns.isAwaited(ecc, assertIfNotAwaited, methodName);
    }

    /**
     * Send a message to one or more objects.
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} messageType
     * @param {any} expr
     * @param {any} audience
     * @param {any} excluded
     */
    message(ecc, messageType = '', expr = '', audience = [], excluded = []) {
        const frame = ecc.push({ file: __filename, method: 'message', lineNumber: __line });
        try {
            return efuns.message(frame.context, messageType, expr, audience, excluded);
        }
        finally {
            frame.pop();
        }
    }

    get MUDFS() {
        return Object.assign({}, global.MUDFS);
    }

    get objin() {
        return efuns.objin;
    }

    origin(...args) {
        return efuns.origin(...args);
    }

    previousObject(...args) {
        return efuns.previousObject(...args);
    }

    /**
     * Capture the next line of user input
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} type The type of control to create
     * @param {Object.<string,string>} options Additional options used to render the prompt
     * @param {function(string):void} callback A callback that will receive the user's input
     */
    prompt(ecc, type, options = {}, callback = false) {
        efuns.input.prompt(ecc, type, options, callback);
    }

    /**
     * Capture the next line of user input
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} type The type of control to create
     * @param {Object.<string,string>} options Additional options used to render the prompt
     * @returns
     */
    promptAsync(ecc, type, options = {}) {
        return efuns.input.promptAsync(ecc, type, options);
    }

    /**
     * Sets a value (and creates if needed).
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} definingType The class reference attempting to set the value
     * @param {propertyName} value The name of the variable to create
     * @param {any} value The actual value of the property
     * @returns {boolean} Returns true on success.
     */
    set(ecc, definingType, propertyName, value) {
        let frame = ecc.push({ method: 'set', callType: CallOrigin.LocalCall });
        try {
            let key = this.filename;

            if (!key) {
                let cct = ecc.newContext;
                key = cct && cct.filename;
                if (!key) return false;
            }
            let store = driver.storage.get(this, key);
            return store && store.set(definingType, propertyName, value);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Allows us to unwind the Javascript stack without unwinding the MUD stack
     * @param {ExecutionContext} ecc
     * @param {any} callback
     */
    setImmediate(ecc, callback) {
        let child = ecc.fork(),
            isAsync = efuns.isAsync(callback);

        global.setImmediate(async () => {
            let frame = child
                .branch()
                .restore()
                .push({ method: 'setImmediate', isAsync });
            try {
                if (efuns.isAsync(callback))
                    await callback.call(thisObject, frame.context);
                else
                    callback.call(thisObject, frame.context);
            }
            finally {
                frame.pop();
            }
        });
    }

    /**
     * Periodically call a function
     * @param {ExecutionContext} ecc
     * @param {function} callback The function to execute after the timer has expired
     * @param {number} timer The amount of time to delay execution (in ms)
     * @param {...any} args Additional parameters to pass to callback
     * @returns {number} Returns the unique ID/handle for the timer
     */
    setInterval(ecc, callback, timer, ...args) {
        //  TODO: Make this configurable
        if (timer < 50)
            throw new Error('Interval cannot be less than 50ms');

        //  Fork execution
        let childContext = ecc.fork(),
            thisObject = ecc.thisObject;

        let ident = global.setInterval(async () => {
            //  Make this context the active one
            let frame = childContext
                .branch()
                .restore()
                .push({ object: thisObject, method: 'setInterval', callType: CallOrigin.Callout });

            //  Check for the health of this timer
            let hasError = false;

            try {
                //  Insert branched execution context
                args.unshift(frame.context);

                if (efuns.isAsync(callback))
                    await callback.apply(thisObject, args);
                else
                    callback.apply(thisObject, args);
            }
            catch (err) {
                await efuns.logError(frame.branch(), err);
                hasError = true;
            }
            finally {
                if (hasError === true)
                    this.clearInterval(typeof ident === 'number' ? ident : ident[Symbol.toPrimitive]());
                frame.pop();
            }
        }, timer);

        let timerId = typeof ident === 'number' ? ident : ident[Symbol.toPrimitive]();
        Intervals[ident] = childContext.addCustomVariable(`setInterval-${timerId}`, frame.id);
        return timerId;
    }

    /**
     * Call a function after the specified time has past
     * @param {ExecutionContext} ecc
     * @param {function} callback The function to execute after the timer has expired
     * @param {number} timer The amount of time to delay execution (in ms)
     * @param {...any} args Additional parameters to pass to callback
     * @returns {number} Returns the unique ID/handle for the timer
     */
    setTimeout(ecc, callback, timer, ...args) {
        //  TODO: Make this configurable
        if (timer < 50)
            throw new Error('Interval cannot be less than 50ms');

        //  Fork execution
        let childContext = ecc.fork(),
            thisObject = ecc.thisObject;

        let ident = global.setTimeout(async () => {
            let frame = childContext
                .branch()
                .restore()
                .push({ object: thisObject, method: 'setTimeout', callType: CallOrigin.Callout });

            try {
                //  Insert branched execution context
                args.unshift(frame.context);

                if (efuns.isAsync(callback))
                    await callback.apply(thisObject, args);
                else
                    callback.apply(thisObject, args);
            }
            catch (err) {
                await efuns.logError(frame.branch(), err);
            }
            finally {
                frame.pop();
            }
        }, timer);

        let timerId = typeof ident === 'number' ? ident : ident[Symbol.toPrimitive]();
        Intervals[ident] = childContext.addCustomVariable(`setTimeout-${timerId}`, frame.id);
        return timerId;
    }

    get stderr() {
        return driver.efuns.err;
    }

    get stdin() {
        return driver.efuns.in;
    }

    get stdout() {
        return driver.efuns.out;
    }

    /**
     * Get the current player from the callstack
     * @param {ExecutionContext} ecc
     * @param {any} flag If set then the "true player" is returned (e.g. person who forced action)
     * @returns
     */
    thisPlayer(...args) {
        return driver.efuns.thisPlayer(...args);
    }

    unwrap(...args) {
        return global.unwrap(...args);
    }

    unwrapAsync(...args) {
        return global.unwrapAsync(...args);
    }

    units(units, unitType) {
        return driver.convertUnits(units, unitType);
    }

    wrapper(...args) {
        return global.wrapper(...args);
    }

    /**
     * Write to STDOUT
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} str
     * @returns
     */
    write(ecc, ...str) {
        let frame = ecc.push({ file: __filename, method: 'writeLine', callType: CallOrigin.DriverEfun });
        try {
            efuns.writeToStream(ecc, false, efuns.stdout, ...str);
            return true;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Write to STDOUT
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} str
     * @returns
     */
    writeLine(ecc, ...str) {
        let frame = ecc.push({ file: __filename, method: 'writeLine', callType: CallOrigin.DriverEfun });
        try {
            efuns.writeToStream(ecc, true, efuns.stdout, ...str);
            return true;
        }
        finally {
            frame.pop();
        }
    }

    get UOM() {
        return UnitsOfMeasurement;
    }
}

/**
 * Configure the loader for runtime.
 * @param {GameServer} driver A reference to the game driver.
 */
MUDLoader.configureForRuntime = function (driver) {
    //mudglobal.modifyLoader(MUDLoader.prototype);
};

module.exports = MUDLoader;
