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
        this.objectStack = frames ? frames.slice(0) : [];
        this.onDestroy = false;
        this.previous = prev;
        this.refCount = 0;
        this.released = false;
        /** @type {Object.<string,boolean>} */
        this.sigs = {};

        if (prev) {
            this.client = prev.client;
            this.depth = prev.depth + 1;
            this.input = prev.input;
            this.thisPlayer = prev.thisPlayer;
            this.truePlayer = prev.truePlayer;
            this.$storage = driver.storage.get(this.thisPlayer);
            this.previous.children[this.contextId] = this;
            this.previous.children.length++;
        }

        if (init)
            init(this);

        if (this.objectStack.length === 0)
            MXC.getObjectStack(this);

        if (_debugging) {
            _activeContexts[this.contextId] = this;
            _activeContexts.length++;
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
     * Add frames to the object stack.
     * @param {...MXCFrame} frames One or more frames to add to stack
     * @returns {MXC}
     */
    addFrame(...frames) {
        frames.forEach(frame => {
            if (!(frame.sig in this.sigs)) {
                this.objectStack.unshift(frame);
            }
        });
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
     * Appends new frames to the context object stack.
     * @returns {MXC}
     */
    join() {
        return MXC.getObjectStack(this);
    }

    /**
     * @returns {number}
     */
    get length() {
        return this.objectStack.length;
    }

    /**
     * Release the current context and restore the previous context.
     */
    release() {
        let ptr = this, cur = MXC.init();

        while (ptr) {
            let padding = _debugging && Array(ptr.depth + 1).join('\t');
            if (--ptr.refCount < 1) {
                if (ptr.refCount < 0)
                    throw new Error('MXC.release(): Negative reference count');

                if (_debugging) {
                    if (ptr.contextId in _activeContexts) {
                        delete _activeContexts[ptr.contextId];
                        _activeContexts.length--;
                        if (ptr.depth === 0) {
                            let elp = new Date().getTime() - ptr.start;
                            logger.log(`${padding}- MXC Release [${ptr.expr}]: RefCount: ${ptr.refCount} [depth: ${ptr.depth}, remaining: ${_activeContexts.length}; time: ${elp}ms]`);
                        }
                        else
                            logger.log(`${padding}- MXC Release [${ptr.expr}]: RefCount: ${ptr.refCount} [depth: ${ptr.depth}, remaining: ${_activeContexts.length}]`);
                    }
                    else {
                        logger.log(`Re-release of deleted context ${ptr.contextId}`);
                    }
                }
                ptr.destroy();
            }
            else {
                cur = ptr;
            }
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
            this.refCount++;
            driver.currentContext = this;
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
            clone.join().restore();
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
 * @param {MXC} mxc The context to fill.
 * @returns {MXC} A reference to the original context.
 */
MXC.getObjectStack = function (mxc) {
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
                    col = cs.getColumnNumber(),
                    sig = `${fn}:${func}:${line}:${col}`;

                let frame = {
                    object: ob,
                    file: modulePath,
                    func: func || 'constructor',
                    sig
                };
                if (frame.object === null)
                    throw new Error(`Illegal call in constructor [${modulePath}`);
                result.push(frame);
                if (unguarded) break;
            }
        }
    }
    if (unguarded) 
        mxc.objectStack = result;
    else {
        mxc.addFrame(...result);
    }
    return mxc;
}

/**
 * Initialize a placeholder context (mainly for intellisense)
 * @returns {MXC} The current context
 */
MXC.init = function () {
    return false;
};

module.exports = MXC;
