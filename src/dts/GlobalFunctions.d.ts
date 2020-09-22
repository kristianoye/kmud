/**
 * Constructs a new instance of an object
 * @param t The type to construct
 */
declare function createAsync<TType>(t: { new(): TType }, ...args: any[]): TType;

/**
 * "Magic" function used in getters
 * @param defaultValue
 */
declare function get<T>(defaultValue: T): T;

/**
 * "Magic" function used in setters to set the property value
 * @param newValue The new value to use
 */
declare function set<T>(newValue: T): T;

declare interface Array extends Array<T> {
    /**
     * Iterate through an array asycronously
     * @param callback
     */
    forEachAsync<T>(callback: (element: T, index: number) => void): Promise<T[]>;

    /**
     * Push elements to an array but only if they don't already exist
     * @param items
     */
    pushDistinct<T>(...items: T[]): T[];

    /**
     * Remove an element from an array by value
     * @param value
     */
    removeValue<T>(...value: T[]): T[];
}

declare interface Dictionary<TKey, TVal> {
    /** Indexer for the dictionary */
    [key: TKey]: TVal;
}


declare interface String {
    /**
     * Use this string as a formatting string ala .NET Format()
     * @param args
     */
    fs(...args: any[]): string;
}
