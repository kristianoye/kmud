/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: MUD eXecution Context (MXC).  Maintains object stack and
 * important "thread" context variables (current player, true player,
 * current object, etc).
 */

/** @typedef {{ object: MUDObject, method: string }} ObjectStackItem */

class ExecutionContext {
    constructor() {
        /** @type {ObjectStackItem[]} */
        this.stack = [];

        this.currentObject = false;
        this.thisPlayer = false;
        this.truePlayer = false;
    }

    dispose() {
        this.suspend();
    }

    pop() {
        this.stack.pop();
        this.currentObject = false;
        let m = this.stack.length;

        if (m === 0)
            return this.dispose();
        else
            for (let i = m - 1; i > -1; i--) {
                if (this.stack[i].object) {
                    this.currentObject = this.stack[i].object;
                    break;
                }
            }

        return this;
    }

    push(instance, methodName, fileName, classRef) {
        this.stack.push({ object: instance, method: methodName, file: fileName, typeRef: classRef });
        if (instance) this.currentObject = instance;
        return this;
    }

    restore() {
        driver.executionContext = this;
    }

    suspend() {
        driver.executionContext = false;
    }
}

module.exports = ExecutionContext;