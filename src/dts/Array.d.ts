/** A commonly used callback type */
declare type CheckElement<T> = (value: T, index: number) => boolean;

/** Extensions for Array types */
declare interface Array<T> {
    /**
     * Check to see if any of the elements match the specified criteria
     * @param match A callback to check an element for matching criteria
     */
    any<A extends T>(match?: CheckElement<A>): boolean;

    /**
     * Count the number of matching elements
     * @param match
     */
    count<A extends T>(match?: CheckElement<A>): number;

    /**
     * Set a default value
     * @param defaultValue
     */
    defaultIfEmpty<A extends T>(defaultValue: A): A[];

    /**
     * Get the first matching element or error if none are found
     * @param match
     */
    first<A extends T>(match?: CheckElement<A>): A;

    /**
     * Get the first matching element
     * @param match
     */
    firstOrDefault<A extends T>(match?: CheckElement<A>): A;

    /**
     * Iterate through an array asycronously
     * @param callback
     */
    forEachAsync<A extends T>(callback: (element: A, index: number) => void): Promise<A[]>;

    /**
     * Get the last matching element in an array
     * @param match
     */
    last<A extends T>(match?: CheckElement<A>): A;

    /**
     * Get the last matching element in an array or return default if none is found
     * @param match
     */
    lastOrDefault<A extends T>(match?: CheckElement<A>): A;

    /**
     * Performing an array mapping asynchronously.
     * @param callback
     */
    mapAsync<A extends T, R>(callback: (element: A, index: number) => R): Promise<R[]>;

    /**
     * Order the elements in ascending order based on specified criteria
     * @param orderby
     */
    orderBy<A extends T>(orderby?: (a: A, b: A) => number): A[];

    /**
     * Order the elements in descending order based on specified criteria
     * @param orderby
     */
    orderByDescending<A extends T>(orderBy?: (a: A, b: A) => number): A[];

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

    /**
     * Transform an array
     * @param transform
     */
    select<A extends T, R>(transform?: (element: A) => R): R[];

    /**
     * Return the first element but only if there is one.
     * @param value
     */
    single<A extends T>(check?: CheckElement<A>): A;

    /**
     * Return the first or default element but only if there is one.
     * @param value
     */
    singleOrDefault<A extends T>(check?: CheckElement<A>): A;

    /**
     * Skip a number of elements and return the remainder
     * @param count
     */
    skip<A extends T>(count: number = 1): A[];

    /**
     * 
     * @param count
     */
    take<A extends T>(count: number): A[];


    /**
     * Select elements based on the specified criteria
     * @param check
     */
    where<A extends T>(check?: CheckElement<A>): A[];
}
