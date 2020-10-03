namespace Helpers {
    interface Living {
        /**
         * Check to see how long an object has been idle
         * @param target The object to check
         * @returns Idle time in milliseconds
         */
        queryIdle(target: MUDObject | MUDWrapper): number;
    }
}
