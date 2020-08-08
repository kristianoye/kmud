
/**
 * Constructs a new instance of an object
 * @param t The type to construct
 */
declare async function createAsync<TType>(t: { new(): TType }): TType;