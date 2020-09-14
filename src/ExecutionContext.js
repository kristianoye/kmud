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
    MUDEventEmitter = require('./MUDEventEmitter'),
    uuidv1 = require('uuid/v1');

/** @typedef {{ object: MUDObject, method: string, file: string }} ObjectStackItem */

/**
 * Maitains execution and object stacks for the MUD.
 */
class ExecutionContext extends MUDEventEmitter {
    /**
     * 
     * @param {ExecutionContext} parent The parent context (if one exists)
     * @param {string} handleId The child UUID that identifies child to parent
     */
    constructor(parent = false, handleId = false, detached = false) {
        super();

        if (parent) {
            this.stack = parent.stack.slice(0);

            /** @type {Object.<string,ExecutionContext>} */
            this.asyncChildren = { length: 0 };
            this.alarmTime = parent.alarmTime;
            this.async = true;
            this.awaited = false;
            this.completed = false;
            this.currentVerb = parent.currentVerb;
            this.handleId = handleId || uuidv1();

            /** @type {ExecutionContext} */
            if (!detached) {
                this.parent = parent;
                this.onComplete = parent.onComplete;
            }
            else
                this.onComplete = [];
            this.forkedAt = parent.stack.length;

            this.client = parent.client;
            this.player = parent.player;
            this.truePlayer = parent.truePlayer;

            this.virtualParents = [];

            if (!detached) {
                parent.asyncChildren[this.handleId] = this;
            }
        }
        else {
            /** @type {ObjectStackItem[]} */
            this.stack = [];

            /** @type {Object.<string,ExecutionContext>} */
            this.asyncChildren = { length: 0 };
            this.alarmTime = Number.MAX_SAFE_INTEGER;
            this.async = false;
            this.awaited = undefined;
            this.completed = false;
            this.currentVerb = false;
            this.handleId = handleId || uuidv1();

            /** @type {ExecutionContext} */
            this.parent = false;
            this.forkedAt = 0;
            this.onComplete = [];
            /** @type {ObjectStackItem} */
            this.originalFrame = false;
            this.player = false;
            this.truePlayer = false;
            this.virtualParents = [];
        }
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
        let to = this.thisObject;

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

    asyncBegin() {
        let child = this.fork();
        child.lostFrame = this.stack.shift();
        return child;
    }

    asyncCall(awaitExpr) {
        return this.asyncResult = awaitExpr;
    }

    get asyncResult() {
        return this._asyncResult;
    }

    set asyncResult(val) {
        this._asyncResult = val;
    }

    asyncRestore() {
        driver.restoreContext(this);
    }

    async awaitAsync(type, promiseLike) {
        let ret = [undefined, undefined],
            frame = this.stack.shift();
        try {
            if (promiseLike.completed)
                ret = promiseLike.result;
            else {
                let child = this.asyncChildren[promiseLike.handleId];
                if (child) child.frame = frame;
                this.inAsyncCall = true;
                ret = await promiseLike;
                delete this.inAsyncCall;
            }
            if (type === 'ArrayPattern')
                return [ret.result, ret.error];
            else if (type === 'ObjectPattern')
                return ret;
            else if (ret.error)
                throw ret.error;
            else
                return ret.result;
        }
        catch (ex) {
            console.log(`FATAL: ${ex.message}`);
        }
        finally {
            //  Do context stuff here
            this.join(promiseLike.handleId, frame);
        }
    }

    /**
     * Complete execution
     * @returns {ExecutionContext} Reference to this context.
     */
    complete() {
        let parent = this.parent;
        if (parent) {
            if (this.handleId in parent.asyncChildren === false)
                throw new Error('Crash'); // TODO: Add ability to crash the game
            delete parent.asyncChildren[this.handleId];
            parent.asyncChildren.length--;
            this.completed = true;
            return parent.complete();
        }
        if (this.stack.length === this.forkedAt) {
            if (this.asyncChildren.length === 0) {
                if (this.parent) {
                    this.parent.complete(this);
                }
                //  Make sure not to call completion twice
                if (!this.completed) {
                    this.completed = true;
                    this.onComplete.forEach(cb => {
                        try {
                            cb(this);
                        }
                        catch (err) {
                            logger.log('Error in onComplete handler:', err.message);
                        }
                    });
                    this.emit('complete', this);
                }
            }
            // My children may or may not be done, but the context needs to be cleared anyway
            driver.restoreContext(false);
        }
        else
            driver.restoreContext(this);
        return this;
    }

    get currentFileName() {
        let frame = this.stack[0];
        return frame.file;
    }

    finishAsync() {
        let parent = this.parent;
        delete parent.asyncChildren[this.handleId];
        parent.stack.unshift(this.originalFrame);
    }

    /**
     * Registers a new async call on this execution context.
     * @returns {ExecutionContext} Returns a child context to be used once the async code continues.
     */
    fork(detached = false) {
        if (!detached) this.asyncChildren.length++;
        return new ExecutionContext(this, false, detached);
    }

    getFrame(index) {
        return index > -1 && index < this.length && this.stack[index];
    }

    /**
     * Check access to a guarded function.
     * @param {function(ObjectStackItem):boolean} callback Calls the callback for each frame.
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
            if (frame.unguarded === true)
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

    isValidApplyCall(method, callee) {
        return this.thisObject === driver || this.thisObject === callee;
    }

    /**
     * Join an async result after it has completed
     * @param {string} handleId The unique ID of the child context
     * @param {MUDObjectStack} frame The stack snapshot from just before the async call.
     */
    join(handleId, frame) {
        let child = this.asyncChildren[handleId];

        if (child) child.frame = frame;

        return this;
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
     * @param {any} method
     */
    pop(method) {
        let lastFrame = this.stack.shift();
        if (!lastFrame || lastFrame.callString !== method) {
            if (lastFrame) {
                console.log(`ExecutionContext out of sync; Expected ${method} but found ${lastFrame.callString}`);
            }
            else
                console.log(`ExecutionContext out of sync... no frames left!`);
        }
        if (this.stack.length === this.forkedAt)
            return this.complete();

        return lastFrame;
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

    push(object, method, file, isAsync, lineNumber, callString) {
        this.stack.unshift({
            object,
            method,
            file,
            isAsync: isAsync === true || method.startsWith('async '),
            lineNumber,
            callString: callString || method
        });
        return this;
    }

    restore() {
        driver.restoreContext(this);
        return this;
    }

    suspend() {
        driver.restoreContext();
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
     * Execute an action with an alternate thisPlayer
     * @param {MUDStorage} storage The player that should be "thisPlayer"
     * @param {function(MUDObject, ExecutionContext): any} callback The action to execute
     * @param {boolean} restoreOldPlayer Restore the previous player 
     */
    withPlayer(storage, callback, restoreOldPlayer = true, methodName = false) {
        let player = unwrap(storage.owner);
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
    async withPlayerAsync(storage, callback, restoreOldPlayer = true, methodName = false) {
        let player = unwrap(storage.owner);
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
}

module.exports = ExecutionContext;

