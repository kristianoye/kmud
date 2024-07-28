const { ExecutionContext, CallOrigin } = require("./ExecutionContext");

const
    LOGGER_ALL = 100,
    LOGGER_VERBOSE = 75,
    LOGGER_DEBUG = 50,
    LOGGER_PRODUCTION = 10;

class MUDLogger {
    constructor(level) {
        this.level = typeof level === 'number' ? level : LOGGER_PRODUCTION;
    }

    log() {
        let [frame, ...args] = ExecutionContext.tryPushFrame(arguments, { method: 'log', callType: CallOrigin.Driver });
        try {
            console.log(...args);
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Conditional logging
     * @param {number} level
     * @param {string|function(...any):string} formatter
     * @param {any} args
     */
    logIf(level, formatter, ...args) {
        if (level <= this.level) {
            if (typeof formatter === 'function') {
                let logText = formatter(...args);
                if (logText) console.log(logText);
            }
            else
                console.log(formatter, ...args);
        }
    }
}
global.LOGGER_ALL = LOGGER_ALL;
global.LOGGER_VERBOSE = LOGGER_VERBOSE;
global.LOGGER_DEBUG = LOGGER_DEBUG;
global.LOGGER_PRODUCTION = LOGGER_PRODUCTION;

module.exports = new MUDLogger();
