declare interface MUDModule {
    // #region Properties

    /** Modules that inherit this module */
    children: MUDModule[];

    /** The default export (if any) */
    defaultExport: any;

    /** The directory the target types live in */
    directory: string;

    /** True if the default was explicitly set in the module */
    explicitDefault: boolean;

    /** A collection of exported values */
    exports: Dictionary<string, any>;

    /** The file this module represents */
    filename: string;

    /** Duplicate of filename? */
    fullPath: string;

    /** The collection of object instances */
    instanceMap: Dictionary<string, ArrayLike<MUDObject>>;

    /** Was the module compiled virtually? */
    isVirtual: boolean;

    /** The name of the file without the path */
    name: string;

    /** The parent of this module (if any) */
    parent: MUDModule;

    // #endregion

    // #region Methods

    /**
     * Add an item to the module exports
     * @param value The item to export (a class, a function, etc)
     */
    addExport(value: any);

    /**
     * Create an object asynchronously
     * @param type The specific type to create
     * @param instanceData Information for the newly defined object
     * @param args Arguments to pass to the object constructor and/or create method
     * @param factory A custom factory method
     */
    createAsync(type: string, instanceData: CreationContext, args: any[], factory?: (type: any, ...args: any) => MUDObject): Promise<MUDObject>;

    // #endregion
}

declare interface MUDCache {
    /**
     * Attempt to delete a module from the cache.  Will return false if the
     * module is not in the cache or the module successfully loaded.
     * @param key
     */
    delete(key: string): boolean;

    /**
     * Fetch a module from the cache
     * @param key The name of the module to retrieve from the cache.
     */
    get(key: string | MUDObject): MUDModule;

    /**
     * Get an existing module or create one if it does not exist
     * @param filename
     * @param fullPath
     * @param muddir
     * @param isVirtual
     * @param isMixin
     * @param parent
     */
    getOrCreate(filename: string, fullPath: string, muddir: string, isVirtual: boolean, isMixin: boolean, parent: MUDModule): MUDModule;

    /**
     * Attempt to fetch the specific type definition from a module
     * @param file
     * @param typeName
     */
    getType(file: string, typeName: string): () => MUDObject;

    /**
     * Normalize a module name
     * @param filename The module name to normalize
     */
    normalize(filename: string): string;

    /**
     * Get a module based on its normalized name
     * @param filename
     */
    resolve(filename: string): MUDModule;

    /**
     * Store a module in the cache
     * @param module The module to store
     */
    store(module: MUDModule): MUDCache;
}