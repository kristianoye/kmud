/// <reference path="GameServer.d.ts"/>

/**
 * Provides an API that may be used by every object in the game.
 */
declare class EFUNProxy {
    currentVerb(): string;
    deepInventory(target: MUDObject): MUDObject[];
    deepInventory(target: MUDObject, callback: (inv: MUDObject[]) => void): void;
    driver: GameServer;
    exec(oldBody: MUDObject, newBody: MUDObject): boolean;
    exec(oldBody: MUDObject, newBody: MUDObject, callback: (oldBody: MUDObject, newBody: MUDObject) => void): boolean;
    featureEnabled(name: string): boolean;

    /**
     * Returns a list of permissions that are currently active.
     */
    activePermissions(): ArrayLike<string>;

    /**
     * Adds a prompt
     * @param prompt
     */
    addPrompt(prompt: MUDPrompt, callback: (input: string) => void): void;

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

    columnText(values: string[]): string;
    columnText(values: string[], width: number): string;

    /**
     * Attempts to consolidate a collection of strings into unique strings and counts.
     * @param items
     */
    consolidateArray(items: ArrayLike<MUDObject | string>): string;

    /**
     * Encrypts a plain text password.
     * @param plain
     */
    createPassword(plain: string): string;

    /**
     * Encrypts a plain text password.
     * @param plain
     * @param callback
     */
    createPassword(plain: string, callback: (enc: string) => void): void;

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
     * Attempts to create a directory expression.
     * @param {string} path The path to create.
     * @param {MkDirOptions} opts Additional information for mkdir.
     * @returns {boolean} True if the path exists or was created or false if it failed.
     */
    mkdir(expr: string, opts: MkDirOptions): boolean;

    /**
     * Attempts to asynchronously create a directory expression.
     * @param {string} path The path to create.
     * @param {MkDirOptions} opts Additional information for mkdir.
     * @param {function} callback The callback to execute when the attempt is complete.
     */
    mkdir(path: string, opts: MkDirOptions, callback: (success: boolean, err: Error) => void): void;

    /**
     * Attempts to asynchronously create a directory expression.
     * @param {string} path The path to create.
     * @param {function} callback The callback to execute when the attempt is complete.
     */
    mkdir(path: string, callback: (success: boolean, err: Error) => void): void;

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
     * Returns the targets idle time in milliseconds.
     * @param target
     */
    queryIdle(target: MUDObject): number;

    /**
     * Returns the verb that is currently executing.
     */
    queryVerb(): string;

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

let efuns = new EFUNProxy;
