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
     */
    join() {
        this.objectStack.push(...driver.getObjectStack());
        return this;
    }

    /**
     * Restore the context to the driver scope.
     */
    restore() {
        driver.currentContext = this;
        driver.currentVerb = this.currentVerb;
        driver.thisPlayer = this.thisPlayer;
        driver.truePlayer = this.truePlayer;
    }

    /**
     * Run a block of code in this context and then switch back.
     * @param {function(...any):any} callback
     */
    run(callback) {
        let prev = new MXC();
        try {
            this.restore();
            return callback();
        }
        catch (ex) {
            throw driver.cleanError(ex);
        }
        finally {
            prev.restore();
        }
    }
}