/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: MUD eXecution Context (MXC).  Maintains object stack and
 * important "thread" context variables (current player, true player,
 * current object, etc).
 */
const
    CreationContext = require('./CreationContext'),
    uuidv1 = require('uuid/v1'),
    MUDObject = require('./MUDObject'),
    CallOrigin = Object.freeze({
        Unknown: 0,
        Driver: 1 << 0,
        LocalCall: 1 << 1,
        CallOther: 1 << 2,
        SimulEfun: 1 << 3,
        Callout: 1 << 4,
        DriverEfun: 1 << 5,
        FunctionPointer: 1 << 6,
        Functional: 1 << 7,
        Constructor: 1 << 8,
        GetProperty: 1 << 9,
        SetProperty: 1 << 10
    });

var
    contexts = {};

/**
 * Represents a single frame on the MUD call stack
 */
class ExecutionFrame {
    /**
     * Construct a new frame
     * @param {ExecutionContext} context The context in which this frame is executing
     * @param {MUDObject} thisObject The object performing the action
     * @param {string} filename The file in which the executing method exists
     * @param {string} method The name of the method being executed
     * @param {number} lineNumber The line number at which the call was made
     * @param {string} callstring This USUALLY the same as the method
     * @param {boolean} isAsync More informative than useful, now
     * @param {number} callType The call origin type
     * @param {boolean} isUnguarded Unguarded frames short-circuit security and prevent checks against previous objects
     */
    constructor(context, thisObject, filename, method, lineNumber, callstring = false, isAsync = false, isUnguarded = false, callType = 0) {
        /**
         * Is this frame awaiting a result?
         */
        this.awaitCount = 0;

        /** 
         * The unique UUID of this frame
         * @type {string}
         */
        this.id = uuidv1();

        /** 
         * The context in which this frame is executing 
         * @type {ExecutionContext}
         */
        this.context = context;

        /**
         * The object performing the action 
         * @type {MUDObject}
         */
        this.object = thisObject || context.thisObject;

        /**
         * How was this method invoked?
         */
        this.callType = callType || CallOrigin.Unknown;

        /**
         * The method name + extra decorations (e.g. static async [method]) 
         * @type {string}
         */
        this.callString = callstring || method;

        /**
         * The file in which the executing method exists 
         * @type {string}
         */
        this.file = filename || thisObject.filename;
        /** 
         * The name of the method being executed 
         * @type {string}
         */
        this.method = method;

        /**
         * The line number at which the call was made 
         * @type {number}
         */
        this.lineNumber = lineNumber || 0;

        /** More informative than useful, now
         * @type {boolean}
         */
        this.isAsync = isAsync === true;

        /**
         * When was the method put on the stack?
         */
        this.startTime = driver.efuns.ticks;

        /**
         * Unguarded frames short-circuit security and prevent checks against previous objects 
         * @type {boolean}
         */
        this.unguarded = isUnguarded === true;
    }

    getContext() {
        return this.context;
    }

    /**
     * How did this call originate?
     */
    get origin() {
        let prev = this.context.length > 1 ? this.context.stack[1] : false,
            val = CallOrigin.Unknown;

        if (prev) {
            if (prev.object !== this.object)
                val |= CallOrigin.CallOther;
            else if (prev.object == this.object)
                val |= CallOrigin.LocalCall;

            val |= prev.callType;
        }
        return val;
    }

    /**
     * Pop this frame off the execution stack
     * @param {boolean} yieldBack
     */
    pop(yieldBack = false) {
        this.context.pop(this.method, this.isAsync === true || yieldBack === true);
    }

    /**
     * The execution cost of this frame in ticks
     * @returns {number}
     */
    get ticks() {
        return this.startTime - driver.efuns.ticks;
    }
}

/**
 * Maitains execution and object stacks for the MUD.
 */
class ExecutionContext {
    /**
     * 
     * @param {ExecutionContext} parent The parent context (if one exists)
     * @param {string} handleId The child UUID that identifies child to parent
     */
    constructor(parent = false) {
        /** 
         * Storage for custom runtime variables
         * @type {Object.<string,any>} 
         */
        this.customVariables = {};

        /** @type {function[]} */
        this.onComplete = [];
        this.handleId = uuidv1();
        this.completed = false;

        /** @type {ExecutionFrame[]} */
        this.stack = [];

        if (parent) {
            /** @type {ExecutionFrame[]} */
            this.stack = parent.stack.slice(0);
            this.forkedAt = parent.stack.length;
            this.alarmTime = parent.alarmTime;
            this.currentVerb = parent.currentVerb || false;
            this.client = parent.client;
            this.player = parent.player;
            this.truePlayer = parent.truePlayer;
        }
        else {
            this.alarmTime = Number.MAX_SAFE_INTEGER;// driver.efuns.ticks + 5000;
            this.currentVerb = false;
            this.forkedAt = 0;
            this.player = false;
            this.truePlayer = false;
        }
        contexts[this.handleId] = this;
    }

    /**
     * Add a new constructor context to the LIFO stack
     * @param {CreationContext} creationContext Details of the object being constructed
     * @returns {CreationContext} Returns the newly created context
     */
    addCreationContext(creationContext) {
        if (!this.creationContexts)
            this.creationContexts = [];
        this.creationContexts.unshift(new CreationContext(creationContext));
        return this.creationContexts[0];
    }

    /**
     * Add a custom value
     * @param {string} key
     * @param {any} val
     */
    addCustomVariable(key, val) {
        if (typeof key === 'string' && key.length > 0)
            this.customVariables[key] = val;
        return this;
    }

    /**
     * Add a new constructor context to the LIFO stack
     * @param {CreationContext} creationContext Details of the object being constructed
     * @returns {CreationContext} Returns the newly created context
     */
    addVirtualCreationContext(creationContext) {
        if (!this.virtualCreationContexts)
            this.virtualCreationContexts = [];
        this.virtualCreationContexts.unshift(new CreationContext(creationContext, true));
        return this.virtualCreationContexts[0];
    }

    alarm() {
        if (this.alarmTime && efuns.ticks > this.alarmTime) {
            let err = new Error(`Maxiumum execution time exceeded`);
            err.code = 'MAXECT';
            throw err;
        }
        return this;
    }

    /**
     * Check to see if the current protected or private call should be allowed.
     * @param {MUDObject} thisObject The current 'this' object in scope (or type if in a static call)
     * @param {string} access Access type (private, protected, etc)
     * @param {string} method The name of the method being accssed
     * @param {string} fileName The file this 
     */
    assertAccess(thisObject, access, method, fileName) {
        let to = this.thisObject || thisObject;

        if (!to) // static method?
            throw new Error(`Cannot access ${access} method '${method}'`);

        if (to === thisObject)
            return true;

        if (to === driver || this.thisObject === driver.masterObject)
            return true;

        if (access === "private")
            throw new Error(`Cannot access ${access} method '${method}' in ${thisObject.filename}`);

        else {
            let friendTypes = thisObject.constructor.friendTypes;
            if (Array.isArray(friendTypes)) {
                for (let i = 0, m = friendTypes.length; i < m; i++) {
                    if (this.thisObject instanceof friendTypes[i])
                        return true;
                }
            }
            if (access === "package") {
                let parts = driver.efuns.parsePath(this.thisObject.baseName);
                if (parts.file !== fileName)
                    throw new Error(`Cannot access ${access} method '${method}' in ${thisObject.filename}`);
            }
            else if (access === "protected") {
                if (thisObject instanceof MUDObject && to instanceof MUDObject) {
                    let thisType = thisObject.constructor;
                    if (to instanceof thisType === false)
                        throw new Error(`Cannot access ${access} method '${method}' in ${thisObject.filename}`);
                }
            }
        }
        return true;
    }

    /**
     * Await an asyncronous call and yield back the execution time
     * @param {function(...):any} asyncCode
     */
    awaitResult(asyncCode) {
        return new Promise(async (resolve, reject) => {
            let startTime = new Date().getTime(),
                frame = this.stack[0];

            try {
                frame.awaitCount++;
                this.restore();
                let result = await asyncCode();

                resolve(result);
            }
            catch (err) {
                reject(err);
            }
            finally {
                let ellapsed = (new Date().getTime() - startTime);
                this.alarmTime += ellapsed;
                frame.awaitCount--;
                this.restore();
            }
        });
    }

    /**
     * Complete execution
     * @returns {ExecutionContext} Reference to this context.
     * @param {boolean} forceCompletion If true then the context is forced to be finish regardless of state
     */
    async complete(forceCompletion=false) {
        try {
            if (this.stack.length === this.forkedAt || true === forceCompletion) {
                for (let i = 0; i < this.onComplete; i++) {
                    try {
                        let callback = this.onComplete[i];

                        if (efuns.isAsync(callback))
                            await callback();
                        else
                            callback();
                    }
                    catch (err) {
                        console.log(`Error in context onCompletion: ${err}`);
                    }
                }
                driver.restoreContext(false);
            }
            else {
                driver.restoreContext(this);
            }
        }
        finally {
            delete contexts[this.handleId];
        }
        return this;
    }

    get currentFileName() {
        let frame = this.stack[0];
        return frame.file || false;
    }

    /**
     * Spawn a new child context for an async process like setTimeout or setInterval
     * @returns {ExecutionContext} Returns a child context.
     */
    fork() {
        return new ExecutionContext(this, false);
    }

    /**
     * Get all executing? contexts
     * @returns {Object.<string,ExecutionContext>}
     */
    static getContexts() {
        return Object.assign({}, contexts);
    }

    /**
     * Get a custom variable
     * @param {string} key
     */
    getCustomVariable(key) {
        if (key in this.customVariables)
            return this.customVariables[key];
    }

    /**
     * Get the specified execution frame from the stack
     * @param {number} index The index of the frame to fetch
     */
    getFrame(index) {
        return index > -1 && index < this.length && this.stack[index];
    }

    /**
     * Get shell options for the current player
     * @param {string} verb The command verb that is about to be executed.
     * @returns {CommandShellOptions}
     */
    async getShellOptionsAsync(verb) {
        if (this.player) {
            return await driver.driverCallAsync('getShellOptions', async () => {
                let player = unwrap(this.player);

                if (player) {
                    /** @type {CommandShellOptions} */
                    let result = await player.applyGetShellSettingsAsync(verb);

                    result.allowAliases = result.allowAliases || !!result.aliases;
                    result.allowHistory = result.allowHistory || !!result.history;
                    result.allowEnvironment = result.allowEnvironment || !!result.environment;

                    return result;
                }
                return {};
            });
        }
        return {};
    }

    /**
     * Check access to a guarded function.
     * @param {function(ExecutionFrame):boolean} callback Calls the callback for each frame.
     * @param {function(...any): any} [action] An optional action to perform
     * @returns {boolean} Returns true if the operation is permitted or false if it should fail.
     */
    async guarded(callback, action = false, rethrow = false) {
        let isAsync = driver.efuns.isAsync(callback);
        for (let i = 0, max = this.length, c = {}; i < max; i++) {
            let frame = this.getFrame(i);

            if (!frame.object && !frame.file)
                continue; // Does this ever happen?
            else if (frame.object === driver)
                continue; // The driver always succeeds
            else if (frame.object === driver.masterObject)
                return true; // The master object always succeeds as well
            else if (c[frame.file])
                continue;
            else if (isAsync && (c[frame.file] = await callback(frame)) === false)
                return false;
            else if ((c[frame.file] = callback(frame)) === false)
                return false;
            else if (frame.unguarded === true)
                break;
        }
        if (action) {
            try {
                if (driver.efuns.isAsync(action))
                    return await action();
                else
                    return action();
            }
            catch (err) {
                if (rethrow) throw err;
            }
            return false;
        }
        return true;
    }

    get isAwaited() {
        return this.stack.length > 0 && this.stack[0].awaitCount > 0;
    }

    get length() {
        return this.stack.length;
    }

    get newContext() {
        if (Array.isArray(this.creationContexts))
            return this.creationContexts[0];
        return undefined;
    }

    set newContext(ctx) {
        if (!Array.isArray(this.creationContexts))
            this.creationContexts = [];
        this.creationContexts[0] = ctx;
        return ctx;
    }

    /**
     * Pops a MUD frame off the stack
     * @param {string | ExecutionFrame} method
     * @param {boolean} yieldBack If true, then the call duration is yielded back to the alarm time
     */
    pop(method, yieldBack=false) {
        let lastFrame = this.stack.shift();

        if (method instanceof ExecutionFrame)
            method = method.callString;

        if (!lastFrame || lastFrame.callString !== method) {
            if (lastFrame) {
                console.log(`ExecutionContext out of sync; Expected ${method} but found ${lastFrame.callString}`);
            }
            else
                console.log(`ExecutionContext out of sync... no frames left!`);
        }

        if (true === yieldBack) {
            this.alarmTime += lastFrame.ticks;
        }

        if (this.stack.length === this.forkedAt) {
            this.completed = true;
            process.nextTick(async () => {
                await this.complete();
            });
            return this;
        }

        return lastFrame;
    }

    popCurrentFrame() {
        let frame = this.stack[0];
        return this.pop(frame.callString);
    }

    popCreationContext() {
        if (Array.isArray(this.creationContexts)) {
            let ctx = this.creationContexts.shift();
            if (this.creationContexts.length === 0)
                delete this.creationContexts;
            return ctx;
        }
        return undefined;
    }

    popVirtualCreationContext() {
        if (Array.isArray(this.virtualCreationContexts)) {
            let ctx = this.virtualCreationContexts.shift();
            if (this.virtualCreationContexts.length === 0)
                delete this.virtualCreationContexts;
            return ctx;
        }
        return undefined;
    }

    /**
     * Returns the previous object
     */
    get previousObject() {
        let prev = this.previousObjects;
        return prev.length > 1 && prev[1];
    }

    /**
     * Returns the previous objects off the stack
     * @type {MUDObject[]}
     */
    get previousObjects() {
        return this.stack
            .filter(f => f.object instanceof MUDObject)
            .slice(0)
            .map(f => f.object);
    }

    /**
     * Push a new frame onto the stack
     * @param {any} object
     * @param {any} method
     * @param {any} file
     * @param {any} isAsync
     * @param {any} lineNumber
     * @param {any} callString
     * @param {boolean} [isUnguarded]
     * @returns {ExecutionContext}
     */
    push(object, method, file, isAsync, lineNumber, callString, isUnguarded, callType = 0) {
        let newFrame = new ExecutionFrame(this, object, file, method, lineNumber, callString, isAsync, isUnguarded, callType);
        this.stack.unshift(newFrame);
        return this;
    }

    /**
     * Push a new frame onto the stack
     * @param {MUDObject} object
     * @param {string} method
     * @param {string} file
     * @param {boolean} isAsync
     * @param {number} lineNumber
     * @param {string} callString
     * @param {boolean} [isUnguarded]
     * @returns {ExecutionFrame}
     */
    pushFrame(object, method, file, isAsync, lineNumber, callString = false, isUnguarded = false, callType = 0) {
        this.push(object, file, method, lineNumber, callString, isAsync, isUnguarded, callType);
        return this.stack[0];
    }

    /**
     * Shortcut for pushing partial frames to stack
     * @param {{object:MUDObject?, file:string?, method:string, lineNumber:number?, callString:string?, isAsync:boolean?, isUnguarded:boolean?, callType:number? }} frameInfo
     */
    pushFrameObject(frameInfo) {
        if (typeof frameInfo !== 'object')
            throw new Error('CRASH: pushFrameObject() received invalid parameter');
        else if (typeof frameInfo.method !== 'string')
            throw new Error('CRASH: pushFrameObject() received invalid parameter');

        let { object, file, method, lineNumber, callString, isAsync, isUnguarded, callType } = frameInfo;
        let frame = this.pushFrame(object || this.thisObject,
            file || object?.filename,
            method,
            lineNumber || 0,
            callString || method,
            isAsync || false,
            isUnguarded || false,
            callType || 0);
        return frame;
    }

    /**
     * Remove a custom variable
     * @param {string} id
     */
    removeCustomVariable(id) {
        if (typeof id === 'string' && id in this.customVariables)
            delete this.customVariables[id];
    }

    /**
     * Remove a frame out of order based on its ID
     * @param {string} frameId The frame's UUID
     */
    removeFrameById(frameId) {
        let index = this.stack.findIndex(frame => frame.id === frameId);
        if (index > -1) {
            let result = this.stack.splice(index, 1);
            return result.length > 0;
        }
        return false;
    }

    /**
     * Restore this context to the active context in the driver
     * @returns
     */
    restore() {
        driver.restoreContext(this);
        return this;
    }

    /**
     * Returns the current object
     * @type {MUDObject}
     */
    get thisObject() {
        for (let i = 0, m = this.stack.length; i < m; i++) {
            let ob = this.stack[i].object;

            if (ob instanceof MUDObject)
                return ob;

            // NEVER expose the driver directly to the game, use master instead
            if (ob === driver)
                // The only exception is when loading the masterObject itself
                return driver.masterObject || driver;
        }
        return false;
    }

    validSyncCall(filename, lineNumber, expr) {
        let ecc = driver.getExecution(),
            frame = ecc && ecc.stack[0] || false;

        let result = expr();
        if (driver.efuns.isPromise(result)) {
            if (frame)
                throw new Error(`${frame.file}.${frame.method} [Line ${lineNumber}]; Call to must be awaited; e.g. await ${expr}`);
            else
                throw new Error(`All asyncronous method calls must be awaited`);
        }
        return result;
    }

    get virtualContext() {
        if (!this.virtualCreationContexts)
            return false;
        else
            return this.virtualCreationContexts[0];
    }

    /**
     * Adds a listener to the complete queue
     * @param {function(ExecutionContext):void} callback The callback to fire when execution is complete.
     */
    whenCompleted(callback) {
        this.onComplete.push(callback);
        return this;
    }

    /**
     * Perform an object with a particular object as the current / thisObject
     * @param {MUDObject} obj
     * @param {string} method
     * @param {any} callback
     * @param {any} isAsync
     * @param {any} rethrow
     * @returns
     */
    async withObject(obj, method, callback, isAsync = false, rethrow = true) {
        try {
            let result = undefined;

            this.push(obj, method, obj.filename, isAsync, 0);
            if (callback.toString().startsWith('async'))
                result = await callback();
            else
                result = callback();

            return result;
        }
        catch (ex) {
            if (rethrow)
                throw ex;
        }
        finally {
            this.pop(method);
        }
    }

    /**
     * Execute an action with an alternate thisPlayer
     * @param {MUDStorage|MUDObject} storage The player that should be "thisPlayer"
     * @param {function(MUDObject, ExecutionContext): any} callback The action to execute
     * @param {boolean} restoreOldPlayer Restore the previous player 
     */
    withPlayer(storage, callback, restoreOldPlayer = true, methodName = false, catchErrors = true) {
        let player = false;

        if (storage instanceof MUDObject)
            storage = driver.storage.get(player = storage);
        else
            player = storage.owner;

        let ecc = driver.getExecution(),
            oldPlayer = this.player,
            oldClient = this.client,
            oldStore = this.storage,
            oldShell = this.shell;

        if (methodName)
            ecc.push(player, methodName, player.filename);

        try {
            this.player = player;
            this.client = storage.component || this.client;
            this.shell = storage.shell || this.shell;
            this.storage = storage || this.storage;
            this.truePlayer = this.truePlayer || player;

            return callback(player, this);
        }
        catch (err) {
            console.log('Error in withPlayer(): ', err);
            if (catchErrors === false) throw err;
        }
        finally {
            if (methodName) ecc.pop(methodName);
            if (restoreOldPlayer) {
                if (oldPlayer) this.player = oldPlayer;
                if (oldClient) this.client = oldClient;
                if (oldStore) this.storage = oldStore;
                if (oldShell) this.shell = oldShell;
            }
        }
    }

    /**
     * Execute an action with an alternate thisPlayer
     * @param {MUDStorage} storage The player that should be "thisPlayer"
     * @param {function(MUDObject, ExecutionContext): any} callback The action to execute
     * @param {boolean} restoreOldPlayer Restore the previous player 
     */
    async withPlayerAsync(storage, callback, restoreOldPlayer = true, methodName = false, catchErrors = true) {
        let player = false;

        if (storage instanceof MUDObject)
            storage = driver.storage.get(player = storage);
        else
            player = storage.owner;

        let ecc = driver.getExecution(),
            oldPlayer = this.player,
            oldClient = this.client,
            oldStore = this.storage,
            oldShell = this.shell;

        if (methodName)
            ecc.push(player, methodName, player.filename, true);

        try {
            this.player = player;
            this.client = storage.component || this.client;
            this.shell = storage.shell || this.shell;
            this.storage = storage || this.storage;
            this.truePlayer = this.truePlayer || player;

            return await callback(player, this);
        }
        catch (err) {
            console.log('Error in withPlayerAsync(): ', err);
            if (catchErrors === false) throw err;
        }
        finally {
            if (methodName)
                ecc.pop(methodName);
            if (restoreOldPlayer) {
                if (oldPlayer) this.player = oldPlayer;
                if (oldClient) this.client = oldClient;
                if (oldStore) this.storage = oldStore;
                if (oldShell) this.shell = oldShell;
            }
        }
    }
}

module.exports = { ExecutionContext, ExecutionFrame, CallOrigin };

