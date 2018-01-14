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
        this.currentVerb = driver.currentVerb;
        this.objectStack = frames || driver.getObjectStack();
        this.previous = prev || false;
        this.thisPlayer = driver.thisPlayer;
        this.truePlayer = driver.truePlayer;
        this.refCount = 0;
    }

    /**
     * Increment the reference count.
     */
    increment() {
        this.refCount++;
        return this;
    }

    /**
     * Appends new frames to the context object stack.
     * @returns {MXC}
     */
    join() {
        this.objectStack.push(...driver.getObjectStack());
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
            driver.restoreContext(this.previous);
        }
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
        return this;
    }

    /**
     * Run a block of code in this context and then switch back.
     * @param {function(...any):any} callback
     * @param {any[]} args The arguments to pass to the callback.
     */
    run(callback, args) {
        try {
            this.join().restore();
            return callback(...args);
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
        return mxc.run(callback, args);
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
