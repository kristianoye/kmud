declare class MUDLoader {
    include(path: ...string[]): MUD;

    /**
     * Imports one or more modules
     * @param {...string[]} path
     */
    imports(path: ...string[]): MUD;

    /**
     * Returns true if the primary type is a singleton (e.g. cannot be cloned).
     * @returns {boolean} If true then copies of the object cannot be made with cloneObject().
     */
    isSingleton(): boolean;

    /**
     * Sets the singleton flag.
     * @param {boolean} flag The value of the singleton flag.  If true then the item may not be cloned.
     */
    isSingleton(flag: boolean): boolean;
}

let MUD = new MUDLoader;

declare class MUDObject
{
    /** Basename is like filename except the clone number is not attached */
    readonly basename: string;

    /** Contains the name of the directory the object was loaded from */
    readonly directory: string;

    /** Contains the name of the file the object was loaded from */
    readonly filename: string;

    /** Contains the instanceId of the object.  If > 0 then this object is a clone */
    readonly instanceId: number;

    /** Contains an array of strings indicating what permissions the object has */
    readonly permissions: string[];
}

declare class MUDInfo {
    readonly arch: string;
    readonly architecture: string;
    readonly cpuUsage: string;
    readonly gameDriver: string;
    readonly hardware: string;
    readonly mudlibName: string;
    readonly mudlibBaseVersion: string;
    readonly mudMemoryTotal: string;
    readonly mudMemoryUsed: string;
    readonly name: string;
    readonly osbuild: string;
    readonly serverAddress: string;
    readonly systemMemoryUsed: string;
    readonly systemMemoryPercentUsed: string;
    readonly systemMemoryTotal: string;
    readonly uptime: number;
}

declare interface MUDStorage {
    /** Listen for a particular event from the mudlib/driver */
    on(event: string, callback: (...args: any[]) => any): void;

    /** get a property from the storage layer */
    getProperty(prop: string, defaultValue: any): any

    /** set a property in the storage layer */
    setProperty(prop: string, value: any): MUDObject;

    /** set a symbol in the storage layer */
    setSymbol(prop: Symbol, value: any): MUDObject;
}

/**
 * Contains information required to construct a MUD object.
 */
declare interface MUDCreationContext {
    readonly $storage: MUDStorage;

    /** Contains the filename of the module being created */
    readonly filename: string;

    /** Contains the unique instance ID for this object. */
    readonly instanceId: number;

    /** Indicates whether the constructor was called as part of a reload or not */
    readonly isReload: boolean;

    /** Adds a mixin to the resulting object */
    addMixin(module: string): MUDCreationContext;

    hasArg(key: string): boolean;

    hasSymbol(key: symbol): boolean;

    /**
     * Creates one or more properties in the context.
     */
    prop(key: string | object, value?: any): MUDCreationContext;

    shared(key: string | object, value?: any): MUDCreationContext;

    symbols(key: symbol, value: any): MUDCreationContext;

    /**
     * Removes an argument from the collection and returns it.
     */
    takeArg(key: string): any;
    takeArg(key: string, defaultValue: any): any;
    takeArg(key: string, defaultValue: any, preserveValue: boolean): any;
}

declare class EFUNProxy
{

    /**
     * Returns a list of permissions that are currently active.
     */
    activePermissions(): ArrayLike<string>;

    /**
     * Returns true if the specified object has admin rights in the MUD.
     *
     * @param {MUDObject} target The object to check.
     * @returns {boolean} True if the object is an admin.
     */
    adminp(target: object): boolean;

    /**
     * Returns true if the specified object has arch rights in the MUD.
     *
     * @param {MUDObject} target The object to check.
     * @returns {boolean} True if the object is an arch (or admin).
     */
    archp(target: object): boolean;

    /**
     * Converts an array of strings or objects into a sentence fragment that may
     * be used as output to a user.
     *
     * @param {ArrayLike<MUDObject>} list A collection of strings and/or objects.
     * @returns {string} A string in the form of 'two swords, one mace, and three dogs'
     */
    arrayToSentence(list: ArrayLike<MUDObject>): string;

    /**
     * Converts an array of strings or objects into a sentence fragment that may
     * be used as output to a user.
     *
     * @param {ArrayLike<string>} list A collection of strings.
     * @returns {string} A string in the form of 'two swords, one mace, and three dogs'
     */
    arrayToSentence(list: ArrayLike<string>): string;

    /**
    * Converts an array of strings or objects into a sentence fragment that may
    * be used as output to a user.
    *
    * @param {Array<string|MUDObject>} list A collection of strings and/or objects.
    * @param {boolean} useOr Indicate the conjunction should be 'or' and not 'and'
    * @returns {string} A string in the form of 'two swords, one mace, and three dogs'
    */
    arrayToSentence(list: Array<MUDObject | string>, useOr: boolean): string;

    /**
    * Converts an array of strings or objects into a sentence fragment that may
    * be used as output to a user.
    *
    * @param {Array<string|MUDObject>} list A collection of strings and/or objects.
    * @param {boolean} useOr Indicate the conjunction should be 'or' and not 'and'
    * @param {boolean} consolidate Consolidate multiples into one item?  e.g. two swords vs sword, sword
    * @returns {string} A string in the form of 'two swords, one mace, and three dogs'
    */
    arrayToSentence(list: Array<MUDObject | string>, useOr: boolean, consolidate: boolean): string;

    /**
    * Converts an array of strings or objects into a sentence fragment that may
    * be used as output to a user.
    *
    * @param {Array<string|MUDObject>} list A collection of strings and/or objects.
    * @param {boolean} useOr Indicate the conjunction should be 'or' and not 'and'
    * @param {boolean} consolidate Consolidate multiples into one item?  e.g. two swords vs sword, sword
    * @param {boolean} showNumbers Display numbers instead of words when consolidating, e.g. 2 swords vs two swords
    * @returns {string} A string in the form of 'two swords, one mace, and three dogs'
    */
    arrayToSentence(list: Array<MUDObject | string>, useOr: boolean, consolidate: boolean, useNumbers: boolean): string;

    /**
    * Attempts to clone an object.
    * @param {string} file The module to clone
    * @param {...any[]} args Arguments to pass to the constructor.
    * @returns {MUDObject|false} Returns a MUD object or false on failure.
    */
    cloneObject(file: string, ...args: any[]): object;

    /**
     * Attempts to consolidate a collection of strings into unique strings and counts.
     * @param items
     */
    consolidateArray(items: ArrayLike<MUDObject | string>): string;

    /**
    * Returns the nested inventory of the object
    * (e.g. inventory of the object and all containers within that object).
    *
    * @param {object} target The object to get inventory for.
    * @returns {MUDObject[]} Array of MUD objects.
    */
    deepInventory(target: object): object[];

    /**
    * Use this to define a symbol in a module.  This will ensure the same symbol
    * is returned if the module is re-compiled.
    * @param name
    */
    defineSymbol(name: string): symbol;

    /**
     * Attempts to find the desired object based on its filename and optional
     * instance ID (for clones).
     * @param {string} target
     * @returns {MUDObject} The object if found or false if it could not be found.
     */
    findObject(target: string): MUDObject;

    /**
    * Attempt to find a player object in the game.
    * @param target The name or partial name of a player to find.
    * @param allowPartial If true, then the target may contain a unique substring
    * forming the beginning of the target's name.  Example: 'kri' would find
    * 'Kriton' unless there was also a 'Kris' in the game.
    * @returns {Player}
    */
    findPlayer(target: string, allowPartial: boolean): Player;

    /**
    * Attempt to read file information from the disk.
    * @param {String} expr A file expression to evaluate.
    * @param {Number} flags Flags indicating additional information is requested.
    * @param {Function} callback A callback if perming an async getDir.
    * If no callback is specified then the call is synchronous.
    */
    getDir(expr: string, flags: number, callback?: (files: String[], error: Error) => void): Array;

    /**
    * Formats a numeric value as an amount of memory (e.g. 1024 => 1KB)
    * @param value A numeric value to convert.
    * @returns {string} A string version in human readable form.
    */
    getMemSizeString(value: number): string;

    /**
     * Returns true if the object is interactive and attached to a browser.
     * @param {MUDObject} target
     * @returns {boolean} True if the target is a browser false if not.
     */
    hasBrowser(target: MUDObject): boolean;

    /**
     * Includes one or more files.
     * @param {...string} file
     */
    includePath(file: ...string[]): void;

    /**
     * Returns true if the target is a class reference.
     * @param {any} target
     * @returns {boolean} Returns true if the target is a class.
     */
    isClass(target: any): boolean;

    /**
    * Returns true if the specified object is a clone and not a master copy.
    * @param {MUDObject} target The target object to check.
    * @returns {boolean} True if the target is an object and a clone, false if not.
    */
    isClone(target: MUDObject): boolean;

    /**
    * Returns true if the specified file expression resolves to a directory.
    * @param {string} path A file expression to evaluate.
    * @returns {boolean} True if the expression represents a directory, false if not.
    */
    isDirectory(path: string): boolean;
    isDirectory(path: string, callback: (exists: boolean, err: Error?) => void): void;

    /**
    * Returns true if the specified file expression resolves to a regular file.
    * @param {string} path A file expression to evaluate.
    * @returns {boolean} True if the expression represents a file, false if not.
    */
    isFile(path: string): boolean;
    isFile(path: string, callback: (exists: boolean, err: Error?) => void): void;

    /**
     * Returns true if the target is a "living" object.
     * @param target
     */
    isLiving(target: any): boolean;

    /**
    * Execute the specified code only if the objects in the permission stack have
    * the specified permission ID.
    * @param {string} permission The permission to search for.
    * @param {function}  callback The code to execute if the permission check passed.
    * @returns {any|false} Returns what the callback returns.
    */
    ifPermission(permission: string[], callback: (...args?: any[]) => any);

    /**
    * Returns an in-memory object or loads and returns that object if it was not previously loaded.
    * @param {string} path The path to the module to load.
    * @returns {MUDObject} The object or false if the object was invalid.
    */
    loadObject(path: string): MUDObject | false;

    /**
    * Returns an in-memory object or loads and returns that object if it was not previously loaded.
    * @param {string} path The path to the module to load.
    * @param {object} initData Initialization data to pass to the constructor.
    * @returns {MUDObject} The object or false if the object was invalid.
    */
    loadObject(path: string, initData: MUDInit): MUDObject | false;

    /**
     * Attempts to create a directory expression.
     * @param {string} path The path to create.
     * @returns {boolean} True if the path exists or was created or false if it failed.
     */
    mkdir(path: string): boolean;

    /**
     * Attempts to asynchronously create a directory expression.
     * @param {string} path The path to create.
     * @param {function} callback The callback to execute when the attempt is complete.
     */
    mkdir(path: string, callback: function): void;

    /**
    * Returns information about the running MUD.
    * @returns {MUDInfo} Information about the MUD.
    */
    mudInfo(): MUDInfo;

    /**
     * Returns the name of the MUD.
     * @returns {string} The name of the MUD.
     */
    mudName(): string;

    /**
     * Normalizes a player name to all lower case by removing whitespace and non-alphabetic characters.
     * @param {string} name The name to normalize.
     * @returns {string} The normalized name.
     */
    normalizeName(name: string): string;

    /**
     * Determines whether the specified parameter is a player object.
     * @param {any} target The item to check.
     * @returns {boolean} True if the parameter was a player or false if it was something else.
     */
    playerp(target: any): boolean;

    /**
     * Returns a collection of all the active players on the MUD.
     * @returns {MUDObject[]} The active players.
     */
    players(): MUDObject[];

    /**
     * Returns a collection of all of the players on the MUD.
     * @param {boolean} showAll Indicate whether to include linkdead players.
     * @returns {MUDObject[]}
     */
    players(showAll: boolean): MUDObject[];

    /**
     * Attempts to read the contents of a file.
     * @param {string} path The file to read
     * @returns {string|boolean} Returns the file contents if a readable file or false if no file exists.
     */
    readFile(path: string): string | false;

    /**
     * Attempts to asynchronously read the contents of a file.
     * @param {string} path The file to read
     * @param {function} callback The callback to execute when the file has been read.
     */
    readFile(path: string, callback: (content: string, err: Error) => undefined): undefined;

    /**
     * Attempts to read a JSON object from the specified file.
     * @param path
     * @returns {object} Returns an object or false if the operation failed.
     */
    readJsonFile(path: string): object;

    /**
     * Attempts to asynchronously read a JSON object from the specified file.
     * @param {string} path The file to read.
     * @param {function} callback The callback to execute when the operation is complete.
     */
    readJsonFile(path: string, callback: (data: object, err: Error) => void);

    /**
    * Force the recompile of a previously loaded object.  If the object is not
    * already in memory then it will be loaded.
    * @param {string} path The path to the module file.
    * @returns {boolean} True if the object loaded successfully, false if it was not found or failed.
    */
    reloadObject(path: string): boolean;

    /**
     * Resolves a path into a fully-qualified MUD path.
     * @param {string} path The file to resolve.
     * @returns {string} The fully-qualified path.
     */
    resolvePath(path: string): string;

    /**
     * Resolves a path into a fully-qualified MUD path.
     * @param {string} path The file to resolve.
     * @param {string} relativeTo The base directory to resolve from.
     * @returns {string} The fully-qualified path.
     */
    resolvePath(path: string, relativeTo: string): string;

    /**
     * Resolves a path into a fully-qualified MUD path.
     * @param {string} path The file to resolve.
     * @param {function} callback The callback to execute with the fully-qualified path.
     */
    resolvePath(path: string, callback: (resolved: string) => void): void;

    /**
     * Resolves a path into a fully-qualified MUD path.
     * @param {string} path The file to resolve.
     * @param {string} relativeTo The base directory to resolve from.
     * @param {function} callback The callback to execute with the fully-qualified path.
     */
    resolvePath(path: string, relativeTo: string, callback: (resolved: string) => void): void;

    /**
    * Remove a file from the filesystem.
    * @param {string} path The file to remove.
    * @returns {boolean} Returns true if the file was removed or false if not.
    */
    rm(path: string): boolean;

    /**
    * Remove a file from the filesystem asyncronously.
    * @param {string} path The file to remove. 
    * @param {function} callback The callback to execute when the removal is complete.
    */
    rm(path: string, callback: (success: boolean, path: string) => void);

    /**
    * Removes an empty directory from the filesystem.
    * @param {string} path The directory to remove.
    * @returns {boolean} True if the directory was removed.
    */
    rmdir(path: string): boolean;
    rmdir(path: string, callback: (success: boolean, err: Error) => void);

    /**
     * Returns a formatted string (like C's sprintf)
     * @param {string} expr The formatted string which contains symbols like %s for string or %d for number.
     * @param {...any[]} args An ordered list of items to inject into the formatting string.
     * @returns {string} The formatted string.
     */
    sprintf(expr: string, args: ...any[]): string;

    /**
     * Removes the Unicode Byte Order Mark (BOM) if it exists at the beginning of the string.
     * @param {string} content The UTF8 encoded string.
     * @returns {string} The encoded string without the BOM.
     */
    stripBOM(content: string): string;

    /**
    * Calls a block of code using only the current objects permissions.  This
    * is useful for daemons who execute priveledged code for clients with 
    * permissions that would normally be blocked. This should be used with
    * caution and only if the outcome is well-known.
    *
    * @param callback The code to execute with isolate permissions.
    */
    unguarded(callback: (...args: any[]) => any);

    /**
     * Returns true if the supplied target is an immortal.
     * @param {any} target
     * @returns {boolean} True if the target is a wizard or false if not.
     */
    wizardp(target: any): boolean;

    /**
     * Attempt to write a file.
     * @param {string} filename The file to write to.
     * @param {string} content The content to write into the file.
     */
    writeFile(filename: string, content: string): boolean;

    /**
     * Attempt to write a file.
     * @param {string} filename The file to write to.
     * @param {string} content The content to write into the file.
     * @param {function} callback The callback to execute when the write is complete.
     */
    writeFile(filename: string, content: string, callback: (success: boolean, err: Error) => undefined): undefined;

    /**
     * Attempt to write an object to file.
     * @param {string} filename The file to write to.
     * @param {string} content The content to write into the file.
     * @returns {boolean} True if successful, false if not.
     */
        writeJsonFile(filename: string, content: any): boolean;

    /**
     * Attempt to write an object to file.
     * @param {string} filename The file to write to.
     * @param {string} content The content to write into the file.
     * @param {function} callback The callback to execute when the write is complete.
     */
    writeJsonFile(filename: string, content: any, callback: (success: boolean, err: Error) => undefined): undefined;
}

declare function unwrap(target: any): MUDObject | false;
declare function unwrap(target: any, success: (ob: MUDObject) => MUDObject): MUDObject | false;

let efuns = new EFUNProxy;

declare class MUDInputEvent {
    readonly verb: string;
    readonly args: string[];
    readonly error: string;
    readonly original: string;
    readonly callback: function;
    readonly fromHistory: boolean;
}

let MUDEVENT_STOP = 1 << 20;
let MUDEVENT_REMOVELISTENER = 1 << 21;
