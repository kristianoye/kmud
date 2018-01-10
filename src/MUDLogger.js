﻿const
    LOGGER_ALL = 100,
    LOGGER_VERBOSE = 75,
    LOGGER_DEBUG = 50,
    LOGGER_PRODUCTION = 10;

class MUDLogger {
    constructor(level) {
        this.level = typeof level === 'number' ? level : LOGGER_PRODUCTION;
    }

    log(...args) {
        console.log(...args);
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
                console.log(logText);
            }
            else
                console.log(...args);
        }
    }
}
global.LOGGER_ALL = LOGGER_ALL;
global.LOGGER_VERBOSE = LOGGER_VERBOSE;
global.LOGGER_DEBUG = LOGGER_DEBUG;
global.LOGGER_PRODUCTION = LOGGER_PRODUCTION;

global.logger = new MUDLogger();
