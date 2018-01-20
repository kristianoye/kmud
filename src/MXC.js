﻿var
    _nextContextId = 1,
    _activeContexts = [],
    _activeCount = 0,
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
    constructor(prev, frames, init) {
        this.alarm = false;
        this.client = false;
        this.contextId = _nextContextId++;
        this.currentVerb = driver.currentVerb;
        this.depth = 0; 
        this.input = false;
        this.objectStack = frames ? frames.slice(0) : [];
        this.previous = prev;
        this.rawStack = '';
        this.refCount = 0;

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
            _activeContexts.push(this);
            _activeCount++;
            let padding = Array(this.depth + 1).join('  ');

            if (this.depth > 0) {
                this.expr = prev.expr + '->' + this.contextId;
                logger.log(`${padding}* MXC Child [${this.expr}]: [depth: ${this.depth}, active: ${_activeCount}]`);
            }
            else {
                this.expr = this.contextId;
                logger.log(`${padding}* MXC Create [${this.contextId}]: [depth: ${this.depth}, active: ${_activeCount}]`);
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
     */
    clone(callback) {
        driver.currentContext = new MXC(this.increment(), this.objectStack);
        return driver.currentContext;
    }

    /**
     * Clean up a dead context to decrement object references.
     * TODO: This can only happen when all child contexts release.
     */
    destroy() {
        //this.client = undefined;
        //this.currentVerb = undefined;
        //this.input = undefined;
        //this.objectStack = undefined;
        //this.previous = undefined;
        //this.rawStack = undefined;
        //this.thisPlayer = undefined;
        //this.truePlayer = undefined;
    }

    increment() {
        this.refCount++;
        return this;
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
        let padding = _debugging ? Array(this.depth + 1).join('  ') : '';
        if (--this.refCount < 1) {
            if (_debugging) {
                let index = _activeContexts.indexOf(this);
                if (index > -1) {
                    _activeContexts.splice(index, 1);
                    _activeCount--;
                }
                logger.log(`${padding}- MXC Release [${this.expr}]: RefCount: ${this.refCount} [depth: ${this.depth}, remaining: ${_activeCount}; Inactive]`);
            }

            this.previous ? this.previous.restore(false) : driver.restoreContext(false);
            //driver.restoreContext(prev.refCount > 0 ? prev : false);
        }
        else logger.log(`${padding}* MXC Release [${this.expr}]: RefCount: ${this.refCount} [depth: ${this.depth}, remaining: ${_activeCount}; Active]`);
    }

    /**
     * Restore the context to the driver scope.
     * @returns {MXC}
     */
    restore(flag) {
        driver.restoreContext(this);
        if (flag !== false) this.refCount++;
        if (_debugging) {
            let padding = Array(this.depth + 1).join('  ');
            logger.log(`${padding}+ MXC Restore [${this.expr}]: RefCount: ${this.refCount} [depth: ${this.depth}, active: ${_activeCount}]`);
        }
        return this;
    }
}

/**
 * Create an awaiter for an asyncronous call.
 * @returns {function(...any)} An awaiter callback
 */
MXC.awaiter = function (callback) {
    let mxc = driver.getContext(),
        clone = mxc.clone();

    return (...args) => {
        try {
            clone.join();
            clone.restore();
            return callback(...args);
        }
        catch (ex) {
            throw driver.cleanError(ex);
        }
        finally {
            clone.release();
            mxc.release();
        }
    };
};


/**
 * Initialize a placeholder context.
 * @returns {MXC} The current context
 */
MXC.init = function () {
    return driver.currentContext;
};

module.exports = MXC;
