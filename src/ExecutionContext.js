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
    MUDEventEmitter = require('./MUDEventEmitter'),
    { StandardInputStream, StandardOutputStream } = require('./StandardIO'),
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
    constructor(parent = false, handleId = false) {
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
            this.parent = parent;
            this.forkedAt = parent.stack.length;
            this.onComplete = false;

            this.client = parent.client;
            this.player = parent.player;
            this.truePlayer = parent.truePlayer;

            this.virtualParents = [];

            parent.asyncChildren[this.handleId] = this;
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
            this.onComplete = false;
            /** @type {ObjectStackItem} */
            this.originalFrame = false;
            this.player = false;
            this.truePlayer = false;

            this.virtualParents = [];
        }
    }

    alarm() {
        if (this.alarmTime && efuns.ticks > this.alarmTime) {
            throw new Error(`Maxiumum execution time exceeded`);
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
        if (!this.thisObject) // static method?
            throw new Error(`Cannot access ${access} method '${method}'`);

        if (this.thisObject === thisObject)
            return true;

        if (this.thisObject === driver || this.thisObject === driver.masterObject)
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
                if (thisObject instanceof MUDObject &&
                    this.thisObject instanceof MUDObject) {
                    let thisType = thisObject.constructor;
                    if (this.thisObject instanceof thisType === false)
                        throw new Error(`Cannot access ${access} method '${method}' in ${thisObject.filename}`);
                }
            }
        }
        return true;
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
                ret = await promiseLike;
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
        if (this.stack.length === 0) {
            if (this.asyncChildren.length === 0) {
                if (this.parent) {
                    this.parent.complete(this);
                }
                //  Make sure not to call completion twice
                if (!this.completed) {
                    this.completed = true;
                    if (typeof this.onComplete === 'function')
                        this.onComplete(this);
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
    fork() {
        this.asyncChildren.length++;
        return new ExecutionContext(this);
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
    guarded(callback, action = false, rethrow = false) {
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
            else if ((c[frame.file] = callback(frame)) === false)
                return false;
            if (frame.unguarded === true)
                break;
        }
        if (action) {
            try {
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
            isAsync: isAsync === true,
            lineNumber,
            callString: callString || method
        });
        return this;
    }

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
            if (ob instanceof MUDObject) return ob;
            // NEVER expose the driver directly to the game, use master instead
            if (ob === driver) return driver.masterObject;
        }
        return false;
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
            this.client = storage.client || this.client;
            this.shell = storage.shell || this.shell;
            this.storage = storage || this.storage;
            this.truePlayer = this.truePlayer || player;

            return callback(player, this);
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

/**
 * Wraps an asyncronous bit of code for the MUD execution context
 * to keep track of its status and whether it was properly awaited.
 * 
 * @param {function(function(any):void, function(any)): any} asyncCode The method called if the async code succeeds
 * @param {number} [timeout=5000] The maximum amount of time this call is allowed to run for.
 * @param {function(any,Error): void} [callback=undefined] An optional function for old school callback hell.
 * @returns {Promise} Returns a promise wrapper that caps execution time and determines if results are used.
 */
ExecutionContext.asyncWrapper = function (asyncCode, timeout = 5000, callback = false) {
    let ecc = driver.getExecution(),    // Get current execution context
        child = ecc.fork(),             // Spawn child context to monitor this call
//        frame = ecc.stack[0],
        finalValue = undefined,
//        prevFrame = frame && ecc.pop(frame.method),
        timerId = false;                // Timer to ensure prompt resolution

    let promise = new Promise(
        (resolve, reject) => {
            try {
                let finished = (result, error) => {
                    if (timerId) {
                        clearTimeout(timerId), (timerId = false);
                        // Node does not like uncaught rejections... easy enough!
                        resolve(finalValue = { result, error });
                        callback && callback(val, err);
                    }
                };
                timerId = setTimeout(() => finished(undefined, new Error('Async call timeout expired')), timeout);

                //  Make the actual call to do the stuff and get the thing
                let result = asyncCode(
                    val => finished(val, undefined),
                    err => finished(undefined, err));

                //  Unexpected, but we can do that too...
                if (result instanceof Promise && timerId) {
                    result
                        .then(v => finished([v, undefined]))
                        .catch(e => finished([undefined, e]));
                }
            }
            catch (err) {
                reject(err);
                callback && callback(undefined, err);
            }
        })
        .always(result => {
            let cec = driver.getContext();

            //  Call finished syncronously
            if (!cec || cec === ecc) {
                if (child.frame) {
                    ecc.stack.unshift(child.frame);
                    delete child.frame;
                    driver.restoreContext(ecc);
                    child.complete();
                }
                else {
                    if (ecc.stack.length === 0)
                        for (let i = 0; i < child.stack.length; i++) {
                            ecc.stack[i] = child.stack[i];
                        }
                    child.complete();
                }
            }
            else
                throw new Error('Fatal error: Wrong context is running');
            return result;
        });

    Object.defineProperties(promise, {
        completed: {
            get: () => { return typeof finalValue !== 'undefined' }
        },
        handleId: {
            get: () => child.handleId
        },
        result: {
            get: () => finalValue
        }
    })

    return Object.freeze(promise);
};

module.exports = ExecutionContext;
