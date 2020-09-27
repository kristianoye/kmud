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
