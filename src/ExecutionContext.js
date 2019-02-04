/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: MUD eXecution Context (MXC).  Maintains object stack and
 * important "thread" context variables (current player, true player,
 * current object, etc).
 */

/** @typedef {{ object: MUDObject, method: string, file: string }} ObjectStackItem */

var
    contextId = 1;

class ExecutionContext {
    constructor(parent) {
        /** @type {ObjectStackItem[]} */
        this.stack = [];

        this.activeChildren = 0;
        this.alarmTime = Number.MAX_SAFE_INTEGER;
        this.async = false;
        this.children = [];
        this.completed = false;
        this.contextId = contextId++;
        /** @type {ExecutionContext} */
        this.parent = parent || false;
        this.forkedAt = 0;
        this.onComplete = false;
        this.thisObject = false;
        this.thisPlayer = false;
        this.truePlayer = false;
    }

    alarm() {
        let now = new Date().getTime();
        if (this.alarmTime && now > this.alarmTime) {
            throw new Error(`Maxiumum execution time exceeded`);
        }
        return this;
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
        }
        console.log(`Context ID ${this.contextId} complete`);
        return this.suspend();
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

    get isDriverCall() {
        return this.thisObject === driver;
    }

    get length() {
        return this.stack.length;
    }

    pop(method) {
        let lastFrame = this.stack.shift();

        if (!lastFrame || lastFrame.method !== method) {
            if (lastFrame) {
                console.log(`ExecutionContext out of sync; Expected ${method} but found ${lastFrame.method}`);
            }
            else
                console.log(`ExecutionContext out of sync... no frames left!`);
        }

        this.thisObject = false;
        let m = this.stack.length;

        for (let i = m - 1; i > -1; i--) {
            if (typeof this.stack[i].object === 'object') {
                this.thisObject = this.stack[i].object;
                break;
            }
        }
        if (m === this.forkedAt)
            return this.complete();

        return this;
    }

    push(object, method, file, isAsync, lineNumber) {
        this.stack.unshift({ object, method, file, isAsync: isAsync === true, lineNumber });

        if (typeof object === 'object')
            this.thisObject = object;
        return this;
    }

    previousObjects() {

    }

    restore() {
        driver.executionContext = this;
        return this;
    }

    suspend() {
        driver.executionContext = false;
        return this;
    }
}

module.exports = ExecutionContext;