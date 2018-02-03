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
    stack = require('callsite');

var
    _nextContextId = 1,
    _activeContexts = { length: 0 },
    _currentContext = null,
    _debugging = false;

/**
 * MUD Execution Context (MXC)
 */
class MXC {
    /**
     * Construct a new execution context.
     * @param {MXC} prev The previous context.
     * @param {MXCFrame[]} frames Initial frames for the stack.
     * @param {function(MXC):void} init Initializer function.
     * @param {string} note A description of what the context is for.
     */
    constructor(prev, frames, init, note) {
        this.aborted = false;
        this.alarm = false;
        this.client = false;

        /** @type {Object.<number,MXC>} */
        this.children = { length: 0 };
        this.contextId = _nextContextId++;
        this.depth = 0;
        this.input = false;
        this.note = note || 'unspecified';
        /** @type {MXCFrame[]} */
        this.stack = [];
        /** @type {MXCFrame[]} */
        this.objectStack = [];
        this.onDestroy = false;
        this.previous = prev;
        this.refCount = 0;
        this.released = false;

        if (prev) {
            this.alarm = prev.alarm;
            this.client = prev.client;
            this.depth = prev.depth + 1;
            this.input = prev.input;
            this.thisObject = prev.thisObject;
            this.thisPlayer = prev.thisPlayer;
            this.truePlayer = prev.truePlayer;
            this.$storage = prev.$storage;
            this.previous.children[this.contextId] = this;
            this.previous.children.length++;
            this.objectStack = prev.objectStack.slice(0);
            this.stack = prev.stack.slice(0);
        }

        if (init) init(this);

        _activeContexts[this.contextId] = this;
        _activeContexts.length++;

        if (_debugging) {
            let padding = Array(this.depth + 1).join('\t');
            if (this.depth > 0) {
                this.expr = prev.expr + '->' + this.contextId;
                logger.log(`${padding}* MXC Child [${this.expr}]: [depth: ${this.depth}, active: ${_activeContexts.length}; note: ${this.note}]`);
            }
            else {
                this.expr = this.contextId;
                logger.log(`${padding}* MXC Create [${this.contextId}]: [depth: ${this.depth}, active: ${_activeContexts.length}; note: ${this.note}]`);
                this.start = new Date().getTime();
            }
        }
    }

    /**
     * Abort the context and any child contexts
     */
    abort() {
        let prev = this.previous;
        for (var i in this.children) {
            if (typeof i === 'number') {
                this.children[i].abort();
            }
        }
        this.aborted = true;
        return this.release();
    }

    /**
     * Add an object frame
     * @param {MUDObject} ob
     * @param {string} method
     * @returns {MXC}
     */
    addFrame(ob, method) {
        if (ob) {
            this.stack.unshift({ object: ob, func: method, file: ob.fileName });
            if (this.thisObject !== ob && ob instanceof MUDObject) {
                this.thisObject = ob;
                this.objectStack.unshift(ob);
            }
        }
        return this;
    }

    /**
     * Clone the context and set this context as the previous context.
     * @param {function(MXC):MXC} init Initializer for the clone.
     * @param {string} note A note describing what the context is for.
     * @returns {MXC} The new context
     */
    clone(init, note) {
        let ptr = this, ret = new MXC(ptr, ptr.objectStack, init, note);
        while (ptr) {
            ptr.refCount++;
            ptr = ptr.previous;
        }
        return ret;
    }

    /**
     * Clean up a dead context to decrement object references.
     * TODO: Delete/remove all properties to try and free mem faster.
     */
    destroy() {
        let prev = this.previous;
        this.released = true;
        this.onDestroy && this.onDestroy();
        if (prev) {
            delete prev.children[this.contextId];
            prev.children.length--;
        }
    }

    /**
     * Get the list of object frames to consider in security calls.
     */
    get effective() {
        let result = [], prev = {}, unguarded = false;
        for (let i = 0, max = this.stack.length; i < max; i++) {
            let o = this.stack[i];
            if (o.func === 'unguarded' && o.file === driver.simulEfunPath) {
                unguarded = true;
                prev = o.object;
                continue;
            }
            if (o.object !== prev) {
                result.push(o);
                prev = o.object;
                if (unguarded)
                    break;
            }
        }
        return result;
    }

    increment() {
        let ptr = this;
        while (ptr) {
            ptr.refCount++;
            ptr = ptr.previous;
        }
        return this;
    }

    /**
     * @returns {number}
     */
    get length() {
        return this.objectStack.length;
    }

    popStack() {
        let frame = this.stack.shift();
        if (this.stack.length === 0)
            this.thisObject = false;
        else if (this.stack[0].object !== this.thisObject) {
            this.objectStack.shift();
            this.thisObject = this.objectStack[0];
        }
        return this.release();
    }

    /** Get the previous objects */
    get previousObjects() {
        let prev = this.stack[0].object, result = [];
        this.stack.forEach(o => o.object !== prev && result.push(prev = o.object));
        return result;
    }

    /**
     * Release the current context and restore the previous context.
     */
    release() {
        let ptr = this, cur = false;

        while (ptr) {
            let padding = _debugging && Array(ptr.depth + 1).join('\t');
            if (--ptr.refCount < 1) {
                if (ptr.refCount < 0)
                    throw new Error('MXC.release(): Negative reference count');
                else {
                    _activeContexts.length--;
                    if (_debugging) {
                        if (ptr.contextId in _activeContexts) {
                            if (ptr.depth === 0) {
                                let elp = new Date().getTime() - ptr.start;
                                logger.log(`${padding}- MXC Release [${ptr.expr}]: RefCount: ${ptr.refCount} [depth: ${ptr.depth}, remaining: ${_activeContexts.length}; time: ${elp}ms; note: ${ptr.note}]`);
                            }
                            else
                                logger.log(`${padding}- MXC Release [${ptr.expr}]: RefCount: ${ptr.refCount} [depth: ${ptr.depth}, remaining: ${_activeContexts.length}; note: ${ptr.note}]`);
                        }
                        else {
                            logger.log(`Re-release of deleted context ${ptr.contextId}`);
                        }
                    }
                    delete _activeContexts[ptr.contextId];
                    ptr.destroy();
                }
            }
            else if (!cur)
                cur = ptr;
            ptr = ptr.previous;
        }
        driver.restoreContext(cur);
    }

    /**
     * Restore the context to the driver scope.
     * @returns {MXC}
     */
    restore() {
        if (!this.released) {
            this.previousContext = driver.currentContext;
            this.refCount++;
            driver.currentContext = this;
            driver.thisObject = this.thisObject;
            driver.thisPlayer = this.thisPlayer;
            driver.truePlayer = this.truePlayer;
            if (_debugging) {
                let padding = Array(this.depth + 1).join('\t');
                logger.log(`${padding}+ MXC Restore [${this.expr}]: RefCount: ${this.refCount} [depth: ${this.depth}, active: ${_activeContexts.length}]`);
            }
        }
        else
            throw new Error('MXC.restore() called on release context');
        return this;
    }

    toString() {
        return `MXC[ID=${this.contextId};Path=${this.expr};Note=${this.note}]`;
    }

    /**
     * Extend the alarm time by set amount
     * @param {number} ms The number of milliseconds to add to the alarm timer.
     */
    snooze(ms) {
        if (this.alarm) this.alarm = new Date().getTime() + ms;
        return this;
    }
}

/**
 * Create an awaiter for an asyncronous call.
 * @returns {function(...any)} An awaiter callback
 */
MXC.awaiter = function (callback, note) {
    let parent = driver.getContext(),
        clone = parent.clone(false, `MXC.awaiter(): ${note}`);
    return (...args) => {
        let prev = driver.getContext();
        try {
            clone.restore();
            return callback(...args);
        }
        finally {
            clone.release();
            driver.restoreContext(prev);
        }
    };
};

/**
 * Return the relevant stack frames for security-based calls.
 * @returns {MXCFrame[]} The extracted object stack.
 */
MXC.getObjectsFromStack = function () {
    let _stack = stack(), result = [], unguarded = false,
        fullStack = [];
    let bs = new Error().stack;

    for (let max = _stack.length, i = 2; i < max; i++) {
        let cs = _stack[i];
        let fn = cs.getFileName() || '[no file]',
            func = cs.getFunctionName();

        if (fn === process.argv[1])
            break;
        else if (fn === driver.efunProxyPath && func === 'unguarded') {
            unguarded = true;
            continue;
        }

        if (typeof fn === 'string') {
            let [modulePath, instanceStr] = fn.split('#', 2);
            let module = driver.cache.get(modulePath),
                instanceId = instanceStr ? parseInt(instanceStr) : 0;

            if (module) {
                let ob = module.instances[instanceId],
                    line = cs.getLineNumber(),
                    col = cs.getColumnNumber();

                let frame = {
                    object: ob,
                    file: modulePath,
                    func: func || 'constructor'
                };
                if (frame.object === null)
                    throw new Error(`Illegal call in constructor [${modulePath}`);
                result.push(frame);
                if (unguarded) break;
            }
        }
    }
    return result;
}

/**
 * Get an active context.
 * @param {number} id The context to find.
 * @returns {MXC} The context
 */
MXC.getById = function (id) {
    return _activeContexts[id] || false;
};

/**
 * Initialize a placeholder context (mainly for intellisense)
 * @returns {MXC} The current context
 */
MXC.init = function () {
    return false;
};

/**
 * Initialize a placeholder context (mainly for intellisense)
 * @returns {MXC[]} An array of context objects.
 */
MXC.initArray = function () {
    return [];
}

/**
 * Initialize a placeholder context (mainly for intellisense)
 * @returns {Object.<string,MXC>} A mapping of context objects.
 */
MXC.initMap = function () {
    return {};
}

module.exports = MXC;
