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
    MUDEventEmitter = require('./MUDEventEmitter');

/** @typedef {{ object: MUDObject, method: string, file: string }} ObjectStackItem */

var
    contextId = 1;

class ExecutionContext extends MUDEventEmitter {
    constructor(parent) {
        super();

        /** @type {ObjectStackItem[]} */
        this.stack = [];

        this.activeChildren = 0;
        this.alarmTime = Number.MAX_SAFE_INTEGER;
        this.async = false;
        this.children = [];
        this.completed = false;
        this.contextId = contextId++;
        this.currentVerb = false;

        /** @type {ExecutionContext} */
        this.parent = parent || false;
        this.forkedAt = 0;
        this.onComplete = false;
        this.thisObject = false;
        this.thisPlayer = false;
        this.truePlayer = false;

        this.virtualParents = [];
    }

    alarm() {
        let now = new Date().getTime();
        if (this.alarmTime && now > this.alarmTime) {
            throw new Error(`Maxiumum execution time exceeded`);
        }
        return this;
    }

    assertAccess(thisObject, access, method, fileName) {
        if (!this.thisObject) // static method?
            throw new Access(`Cannot access ${access} method '${method}'`);

        if (this.thisObject === thisObject)
            return true;

        if (this.thisObject === driver || this.thisObject === driver.masterObject)
            return true;

        if (access === "private")
            throw new Error(`Cannot access ${access} method '${method}' in ${thisObject.filename}`);
        else if (access === "package") {
            let parts = driver.efuns.parsePath(this.thisObject.filename);
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
        return true;
    }

    /**
     * Complete execution
     * @param {ExecutionContext} child The child context that is completing.
     * @returns {ExecutionContext} Reference to this context.
     */
    complete(child) {
        if (child) {
            this.activeChildren--;
        }
        if (this.activeChildren === 0) {
            this.completed = true;

            if (this.parent) {
                this.parent.complete(this);
            }

            if (typeof this.onComplete === 'function')
                this.onComplete(this);
            this.emit('complete', this);
        }
        return this.suspend();
    }

    get currentFileName() {
        let frame = this.stack[0];
        return frame.file;
    }

    fork(isAsync) {
        let newContext = new ExecutionContext(this);

        newContext.async = isAsync === true;
        newContext.stack = this.stack.slice(0);
        newContext.thisObject = this.thisObject;
        newContext.thisPlayer = this.thisPlayer;
        newContext.truePlayer = this.truePlayer;
        newContext.index = this.children.push(newContext);
        newContext.forkedAt = newContext.stack.length;

        this.activeChildren++;

        return newContext;
    }

    assertPrivate(callee, type, ident) {
        if (this.thisObject === callee)
            return true;
        throw new Error(`Illegal attempt to access private ${type} '${ident}'`);
    }

    assertProtected(callee, type, ident) {
        if (this.thisObject === callee)
            return true;
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

        for (let i = 0, max = this.stack.length; i < max ; i++) {
            if (typeof this.stack[i].object === 'object') {
                this.thisObject = this.stack[i].object;
                break;
            }
        }
        if (m === this.forkedAt)
            return this.complete();

        return this;
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

    get previousObjects() {
        return this.stack.filter(f => f.object instanceof MUDObject).slice(1);
    }

    restore() {
        driver.executionContext = this;
        return this;
    }

    setThisPlayer(player, truePlayer, verb) {
        this.thisPlayer = player;
        this.truePlayer = truePlayer || this.truePlayer;
        this.currentVerb = verb || '';

        let $storage = driver.storage.get(player);
        this.thisClient = $storage && $storage.getSymbol('$client');
    }

    suspend() {
        driver.executionContext = false;
        return this;
    }
}

module.exports = ExecutionContext;