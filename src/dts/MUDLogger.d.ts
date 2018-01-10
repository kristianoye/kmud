
/**
 * Interface for logging to the system log.
 */
declare class MUDLogger {
    /**
     * Writes data to the MUD logger (if enabled)
     * @param formatter
     * @param args
     */
    log(formatter: string, ...args: any[]): void;

    /**
     * Conditionally writes to the MUD logger if the debug level is higher than level.
     * @param level
     * @param formatter
     * @param args
     */
    logIf(level: number, formatter: string, ...args: any[]): void;

    /**
     * Conditionally writes to the MUD logger if the debug level is higher than level.
     * @param level
     * @param formatter
     * @param args
     */
    logIf(level: number, formatter: (...args: any[]) => string): void;
}

let LOGGER_PRODUCTION = 90;
let LOGGER_ALL = 0;
let LOGGER_DEBUG = 50;
let LOGGER_VERBOSE = 25

let logger = new MUDLogger;
