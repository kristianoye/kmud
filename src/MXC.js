/**
 * MUD Execution Context (MCX)
 */
class MXC {
    constructor() {
        this.currentVerb = driver.currentVerb;
        this.objectStack = driver.getObjectStack();
        this.thisPlayer = driver.thisPlayer;
        this.truePlayer = driver.truePlayer;
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
        let prev = driver.currentContext;
        try {
            this.join().restore();
            return callback(...args);
        }
        catch (ex) {
            throw driver.cleanError(ex);
        }
        finally {
            driver.currentContext = prev ? prev.restore() : false;
        }
    }
}

/**
 * Create an awaiter for an asyncronous call.
 * @returns {function(...any)} An awaiter callback
 */
MXC.awaiter = function (callback) {
    let mxc = new MXC();
    return (...args) => {
        return mxc.run(callback, args);
    };
};

module.exports = MXC;