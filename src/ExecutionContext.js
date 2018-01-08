
class ExecutionContext {
    /**
     * 
     * @param {GameServer} driver
     * @param {MUDObject[]} stack
     */
    constructor(driver, stack) {
        this.driver = driver;
        this.stack = stack;
        this.thisPlayer = driver.thisPlayer;
        this.truePlayer = driver.truePlayer;
    }
}

module.exports = ExecutionContext;
