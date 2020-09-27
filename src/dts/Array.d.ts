declare interface Array<T> {
    any<A extends T>(match?: (element: A) => boolean): boolean;

    /**
     * Set a default value
     * @param defaultValue
     */
    defaultIfEmpty<A extends T>(defaultValue: A): A[];

    /**
     * Get the first matching element
     * @param match
     */
    firstOrDefault<A extends T>(match?: (value: A, index: number) => boolean): A;

    /**
     * Iterate through an array asycronously
     * @param callback
     */
    forEachAsync<A extends T>(callback: (element: A, index: number) => void): Promise<A[]>;

    mapAsync<A extends T, R>(callback: (element: A, index: number) => R): Promise<R[]>;

    /**
     * Push elements to an array but only if they don't already exist
     * @param items
     */
    pushDistinct<A extends T>(...items: A[]): A[];

    /**
     * Remove an element from an array by value
     * @param value
     */
    removeValue<T>(...value: T[]): T[];
}
