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

            this.thisClient = parent.thisClient;
            this.thisObject = parent.thisObject;
            this.thisPlayer = parent.thisPlayer;
            this.truePlayer = parent.truePlayer;

            this.virtualParents = [];

            parent.asyncChildren[this.handleId] = this;
        }
        else {
            /** @type {ObjectStackItem[]} */
            this.stack = [];

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
            this.thisObject = false;
            this.thisPlayer = false;
            this.truePlayer = false;

            this.virtualParents = [];
        }
    }

    alarm() {
        let now = new Date().getTime();
        if (this.alarmTime && now > this.alarmTime) {
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
            throw new Access(`Cannot access ${access} method '${method}'`);

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
        if (this.stack.length === 0)
            driver.restoreContext(false);
        else
            driver.log('Stack was not empty, yet'); // Fatal error?
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

    get length() {
        return this.stack.length;
    }

    pop(method) {
        let lastFrame = this.stack.shift();
        if (!lastFrame || lastFrame.callString !== method) {
            if (lastFrame) {
                console.log(`ExecutionContext out of sync; Expected ${method} but found ${lastFrame.callString}`);
            }
            else
                console.log(`ExecutionContext out of sync... no frames left!`);
        }

        this.thisObject = false;
        let m = this.stack.length;

        for (let i = 0, max = this.stack.length; i < max; i++) {
            if (typeof this.stack[i].object === 'object') {
                this.thisObject = this.stack[i].object;
                break;
            }
        }
        if (m === this.forkedAt)
            return this.complete();

        return lastFrame;
    }

    get previousObjects() {
        return this.stack.filter(f => f.object instanceof MUDObject).slice(0);
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

        if (typeof object === 'object')
            this.thisObject = object;

        return this;
    }

    restore() {
        driver.restoreContext(this);
        return this;
    }

    setThisPlayer(player, truePlayer, verb) {
        this.thisPlayer = player;
        this.truePlayer = truePlayer || this.truePlayer;
        this.currentVerb = verb || '';

        let $storage = driver.storage.get(player);
        this.thisClient = $storage && $storage.getSymbol('$client');
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
        frame = ecc.stack[0],
        prevFrame = frame && ecc.pop(frame.method),
        timerId = false;                // Timer to ensure prompt resolution

    return new Promise(
        (resolve, reject) => {
            try {
                let finished = (val, err) => {
                    if (timerId) {
                        clearTimeout(timerId), (timerId = false);
                        resolve([val, err]); // Node does not like uncaught rejections... easy enough!
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
            try {
                //  If the promise was resolved syncronously then the original
                //  context should still be loaded.
                let cec = driver.getExecution();
                if (cec) {
                    //  If there is another context running and it is NOT the context
                    //  that spawned this async request then we have serious problems.
                    if (cec !== ecc) throw new Error('FATAL: Context mismatch; Game over, man!');
                    //  Otherwise we need to put the original frame back on the stack (sync).
                    else ecc.stack.unshift(frame);
                }
                else if (!cec) {
                    //  There is no context running; The call was async time and
                    //  the child context must be restored to finish execution.
                    child.restore();
                }
            }
            catch (err) { console.log('Error finalizing async call:', err); }
            return result;
        });
};

module.exports = ExecutionContext;
