/// <reference path="./execution.d.ts" />
/// <reference path="efuns.d.ts" />

declare module 'driver' {
    global {
        /**
         * The object responsible for managing the game
         */
        interface IGameServer {
            /**
             * Clean sensitive data from an error that will be displayed to users
             * @param error The error to scrub
             * @param showExternalFrames If false, then external frames are omitted from trace
             */
            cleanError(error: Error, showExternalFrames: boolean): Error;

            /**
             * Crash the game driver
             * @param error The error that triggered the crash
             * @param exitCode Optional exit code
             */
            crash(error: Error, exitCode?: number): never;

            /**
             * Crash the game driver
             * @param error The error that triggered the crash
             * @param exitCode Optional exit code
             */
            crashAsync(error: Error, exitCode?: number): never;

            /**
             * Execute a function with the MasterObject at the top of the call stack
             * @param method The method name to use on the call stack
             * @param callback The method to call once the new stack frame has been created
             * @param file The filename to use on the call stack
             * @param rethrow Indicates whether any callback exceptions will be rethrown
             */
            driverCall(method: string, callback: (ecc: IExecutionContext) => any, file: string, rethrow: boolean): any;

            /**
             * Execute a function with the MasterObject at the top of the call stack
             * @param method The method name to use on the call stack
             * @param callback The method to call once the new stack frame has been created
             * @param file The filename to use on the call stack
             * @param rethrow Indicates whether any callback exceptions will be rethrown
             */
            driverCallAsync(method: string, callback: (ecc: IExecutionContext) => any, file: string, rethrow: boolean): Promise<any>;

            efuns: IEFUNProxy;

            /**
             * Generate a new UUID
             */
            getNewId(): string;

            /**
             * Returns the number of ticks since the last MUD startup
             */
            uptime(): number;
        }
    }
}
