var
    _nextContextId = 1,
    _activeContexts = { length: 0 },
    _currentContext = null,
    _debugging = true;

/**
 * MUD Execution Context (MXC)
 */
class MXC {
    /**
     * Construct a new execution context.
     * @param {MXC} prev The previous context.
     * @param {MXCFrame[]} frames Initial frames for the stack.
     * @param {function(MXC):void} init Initializer function.
     */
    constructor(prev, frames, init, note) {
        this.alarm = false;
        this.client = false;
        this.children = {};
        this.contextId = _nextContextId++;
        this.depth = 0;
        this.input = false;
        this.note = note || 'unspecified';
        this.objectStack = frames ? frames.slice(0) : [];
        this.onDestroy = false;
        this.previous = prev;
        this.refCount = 0;
        this.released = false;

        if (prev) {
            this.client = prev.client;
            this.depth = prev.depth + 1;
            this.input = prev.input;
            this.thisPlayer = prev.thisPlayer;
            this.truePlayer = prev.truePlayer;
            this.$storage = driver.storage.get(this.thisPlayer);
        }

        if (init)
            init(this);

        if (this.objectStack.length === 0)
            driver.getObjectStack(this);

        if (_debugging) {
            _activeContexts[this.contextId] = this;
            _activeContexts.length++;
            let padding = Array(this.depth + 1).join('\t');

            if (this.previous) this.previous.children[this.contextId] = this;

            if (this.depth > 0) {
                this.expr = prev.expr + '->' + this.contextId;
                logger.log(`${padding}* MXC Child [${this.expr}]: [depth: ${this.depth}, active: ${_activeContexts.length}; note: ${this.note}]`);
            }
            else {
                this.expr = this.contextId;
                logger.log(`${padding}* MXC Create [${this.contextId}]: [depth: ${this.depth}, active: ${_activeContexts.length}; note: ${this.note}]`);
            }
        }
    }

    /**
     * Manually add a frame to the object stack.
     * @param {MXCFrame} frame The frame to add to the stack.
     * @returns {MXC}
     */
    addFrame(frame) {
        this.objectStack.unshift(frame);
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
        this.released = true;
        this.onDestroy && this.onDestroy();
    }

    /**
     * Appends new frames to the context object stack.
     * @returns {MXC}
     */
    join() {
        driver.getObjectStack(this);
        return this;
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
                        logger.log(`${padding}- MXC Release [${ptr.expr}]: RefCount: ${ptr.refCount} [depth: ${ptr.depth}, remaining: ${_activeContexts.length}]`);
                        if (ptr.previous) delete ptr.previous.children[ptr.contextId];
                    }
                    else {
                        logger.log(`Re-release of deleted context ${ptr.contextId}`);
                    }
                }
                ptr.destroy();
            }
            else cur = ptr;
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
            driver.restoreContext(this);
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
 * Initialize a placeholder context.
 * @returns {MXC} The current context
 */
MXC.init = function () {
    return false;
};

module.exports = MXC;
