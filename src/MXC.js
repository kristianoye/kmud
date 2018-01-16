var
    _nextContextId = 1,
    _activeContexts = [],
    _currentContext = null,
    _debugging = false;

/**
 * MUD Execution Context (MCX)
 */
class MXC {
    /**
     * Construct a new execution context.
     * @param {MXC} prev The previous context.
     * @param {MXCFrame[]} frames Initial frames for the stack.
     */
    constructor(prev, frames) {
        this.contextId = _nextContextId++;
        this.currentVerb = driver.currentVerb;
        this.objectStack = frames || [];
        this.previous = (prev && prev.refCount > 0) ? prev : false;
        this.rawStack = '';
        this.thisPlayer = driver.thisPlayer;
        this.truePlayer = driver.truePlayer;
        this.refCount = 0;
        this.ttl = 2000; // time-to-live... ms before it blows up
        if (this.objectStack.length === 0) driver.getObjectStack(this);
        if (_debugging) _activeContexts.push(this);
    }

    /**
     * Manually add a frame to the object stack.
     * @param {MXCFrame} frame The frame to add to the stack.
     * @returns {MXC}
     */
    addFrame(frame) {
        this.objectStack.push(frame);
        return this;
    }

    /**
     * Clone the context and set this context as the previous context.
     */
    clone(callback) {
        let result = new MXC(this, this.objectStack);
        return result.join();
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
        if (--this.refCount < 1) {
            if ((_currentContext = this.previous) && this.previous.refCount > 0) {
                if (_debugging && _activeContexts.indexOf(_currentContext) === -1) {
                    throw new Error('\t-Trying to restore a dead context');
                }
                driver.restoreContext(this.previous);
            }
            else {
                driver.restoreContext(false);
            }
            if (_debugging) {
                let index = _activeContexts.indexOf(this);
                _activeContexts.splice(index, 1);
            }
        }
        // logger.log(`\t- Release [${this.contextId}]: RefCount: ${this.refCount }`);
    }

    /**
     * Restore the context to the driver scope.
     * @returns {MXC}
     */
    restore() {
        driver.currentContext = this;
        driver.currentVerb = this.currentVerb;
        driver.thisPlayer = this.thisPlayer;
        driver.truePlayer = this.truePlayer;
        this.refCount++;
        // logger.log(`\t+ Restore [${this.contextId}]: RefCount: ${this.refCount}`);
        return this;
    }

    /**
     * Run a block of code in this context and then switch back.
     * @param {function(...any):any} callback
     * @param {any[]} args The arguments to pass to the callback.
     */
    run(callback, args) {
        try {
            this.restore();
            return callback(...(args || []));
        }
        catch (ex) {
            throw driver.cleanError(ex);
        }
        finally {
            this.release();
        }
    }
}

/**
 * Create an awaiter for an asyncronous call.
 * @returns {function(...any)} An awaiter callback
 */
MXC.awaiter = function (callback) {
    let mxc = driver.getContext();
    return (...args) => {
        return mxc.clone().run(callback, args);
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
