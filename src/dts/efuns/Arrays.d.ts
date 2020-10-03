namespace Helpers {
    /** Helpers for dealing with arrays */
    interface Arrays {
        /**
         * Determine the intersection of two or more arrays
         * @param arrays
         */
        intersection(...arrays: any[]): any[];
    }
}
