namespace Helpers {
    interface Living {
        /**
         * Determine if the object is "alive"
         * @param target The object to test
         * @returns True if the object is alive
         */
        isAlive(target: MUDObject): boolean;

        /**
         * Check to see how long an object has been idle
         * @param target The object to check
         * @returns Idle time in milliseconds
         */
        queryIdle(target: MUDObject | MUDWrapper): number;
    }
}
