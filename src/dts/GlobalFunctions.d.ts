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

/**
 * Writes to the current player's stdout stream
 * @param message The message to write
 */
declare function write(message: string): true;

/**
 * Writes to the current player's stdout stream (appends a newline)
 * @param message The message to write
 */
declare function writeLine(message: string): true;
