declare namespace Helpers {
    /** Object helpers */
    interface Objects {
        /**
         * Get all modules loaded in memory
         * @param filter A method by which to filter names
         */
        getLoadededModules(filter: (name: string) => boolean): string[];

        /**
         * Reload an object
         * @param expr
         * @param flags
         */
        reloadObjectAsync(expr: string, flags?: number): MUDObject;
    }
}
