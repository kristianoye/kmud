var
    _nextContextId = 1,
    _activeContexts = [],
    _activeCount = 0,
    _currentContext = null,
    _debugging = true;

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
        this.depth = prev && prev.refCount > 0 ? prev.depth + 1 : 0;
        this.objectStack = frames ? frames.slice(0) : [];
        this.previous = this.depth > 0 ? prev : false;
        this.rawStack = '';
        this.thisPlayer = driver.thisPlayer;
        this.truePlayer = driver.truePlayer;
        this.refCount = 0;
        this.ttl = 2000; // time-to-live... ms before it blows up
        if (this.objectStack.length === 0) driver.getObjectStack(this);
        if (_debugging) {
            _activeContexts.push(this);
            _activeCount++;

            let padding = Array(this.depth + 1).join('\t');
            logger.log(`${padding}* Create [${this.contextId}]: [depth: ${this.depth}, active: ${_activeCount}]`);
        }
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
        driver.currentContext = new MXC(this, this.objectStack);
        this.refCount++;
        return driver.currentContext;
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
            let prev = this.previous;
            driver.restoreContext(prev.refCount > 0 ? prev : false);
            if (_currentContext && _currentContext.refCount > 0 && _debugging) {
                logger.log('\t-Trying to restore a dead context');
            }
            if (_debugging) {
                let index = _activeContexts.indexOf(this);
                if (index > -1) {
                    _activeContexts.splice(index, 1);
                    _activeCount--;
                } 
            }
        }
        if (_debugging) {
            let padding = Array(this.depth + 1).join('\t');
            if (this.refCount > 0)
                logger.log(`${padding}- Release [${this.contextId}]: RefCount: ${this.refCount} [depth: ${this.depth}, remaining: ${_activeCount}; ACTIVE]`);
            else
                logger.log(`${padding}- Release [${this.contextId}]: RefCount: ${this.refCount} [depth: ${this.depth}, remaining: ${_activeCount}]`);
        }
    }

    /**
     * Restore the context to the driver scope.
     * @returns {MXC}
     */
    restore() {
        driver.restoreContext(this);
        this.refCount++;
        if (_debugging) {
            let padding = Array(this.depth + 1).join('\t');
            logger.log(`${padding}+ Restore [${this.contextId}]: RefCount: ${this.refCount} [depth: ${this.depth}, active: ${_activeCount}]`);
        }
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
