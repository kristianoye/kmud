/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2020.  All rights reserved.
 * Date: January 27, 2020
 */

declare enum InputType {
    /** The user must decide whether to abort, retry, or fail */
    AbortRetryFail = 'abort-retry-fail',
    /** Render an entire form of inputs to the user */
    Form = 'form',
    /** Request the next line of input from the user */
    Text = 'text',
    /** Request the next line of input from the user but do not echo the characters */
    Password = 'password',
    /** Pick one option from a list */
    PickOne = 'pickone',
    /** Simple binary selection */
    YesNo = 'yes-no',
    /** Yes, no, or cancel */
    YesNoCancel = 'yes-no-cancel'
}

declare namespace Helpers {
    interface Arrays {
        /**
         * Determine the intersection of two or more arrays
         * @param arrays
         */
        intersection(...arrays: any[]): any[];
    }

    interface FileSystem {
        /**
         * Create a copy of an object
         * @param expr The name of the object or an instance to clone
         * @param args Arguments to supply to the constructor and creation process
         */
        cloneObjectAsync(expr: MUDObject | string, ...args: any[]): Promise<MUDObject>;

        /**
         * Create a directory
         * @param expr The path to create
         * @param flags Flags controlling the operation
         */
        createDirectoryAsync(expr: string, flags?: number): Promise<boolean>;

        /**
         * Deletes a directory
         * @param expr The path to delete
         * @param flags Flags controlling the operation
         */
        deleteDirectoryAsync(expr: string, flags?: number): Promise<boolean>;

        /**
         * Deletes a single file from the filesystem
         * @param expr The path to delete
         * @param flags The optional flags controlling the operation
         */
        deleteFileAsync(expr: string, flags?: number): Promise<boolean>;

        /**
         * Get a directory object
         * @param {string} expr The directory expression to fetch
         * @param {number} flags Flags to control the operation
         */
        getDirectoryAsync(expr: string, flags?: number): Promise<string[]>;

        /**
         * Get a filesystem based on its systemId
         * @param id The systemId to retrieve
         */
        getFileSystemById(id: string): FileSystem;

        /**
         * Check to see if an expression is a directory
         * @param expr The path to check
         */
        isDirectoryAsync(expr: string): Promise<boolean>;

        /**
         * Check to see if the path expression is a regular file
         * @param expr The path to check
         */
        isFileAsync(expr: string): Promise<boolean>;

        /**
         * Attempt to load an object
         * @param expr The path expression to load from
         * @param flags Optional flags to control the operation
         */
        loadObjectAsync(expr: string, flags?: number): Promise<MUDObject>;

        /**
         * Read the contents of a directory
         * @param expr The path to read from
         * @param flags Flags to control the operation
         */
        readDirectoryAsync(expr: string, flags?: number): Promise<string[]>;

        /**
         * Read the contents of a file
         * @param expr The path expression to read from
         * @param encoding The optional encoding to use when reading
         */
        readFileAsync(expr: string, encoding?: string): Promise<string> | Promise<Buffer>;

        /**
        * Read JSON from a stream
        * @param {string} expr The location to read from
        * @returns {Promise<object>} The resulting object
        */
        readJsonAsync(expr: string): Promise<object>;

        /**
         * Stat the filesystem
         * @param expr The path expression to read.
         */
        statAsync(expr: string): Promise<FileSystemStat>;

        /**
         * Writes JSON to a stream
         * @param file The filename to write to
         * @param content The content to write.
         * @param flags Optional flags for the operation
         * @param encoding The encoding to use when writing (defaults to utf8)
         */
        writeJsonAsync(file: string, content: any, flags?: number, encoding?: string): Promise<boolean>;
    }

    interface Inputs {
        /**
         * Render a prompt for the user and redirect the response to the specified callback
         * @param type The type of input to render
         * @param options Additional options to pass to the 
         * @param callback
         */
        addPrompt(type: InputType, options: any, callback: (input: string) => void): void;
    }

    interface Objects {
        /**
         * Get all modules loaded in memory
         * @param filter A method by which to filter names
         */
        getLoadededModules(filter: (name: string) => boolean): string[];

        /**
         * Reload an object
         * @param expr
         * @param flags
         */
        reloadObjectAsync(expr: string, flags?: number): MUDObject;
    }
}

declare interface EFUNProxy {
    /**
     * Returns the absolute value of the provided number
     * @param value
     */
    abs(value: number): number;

    /**
     * Binds an action to the active player 
     * @param verb The verb to trigger the callback
     * @param callback The callback method that executes when the user types the command
     * @param number 
     */
    addAction(verb: string, callback: (args: string) => boolean | string): void;

    /**
     * Determines if the specified object is an admin
     * @param target The target to check
     * @returns True if the target is an admin or false if not
     */
    adminp(target: object): boolean;

    /**
     * Determines if the specified object is an arch
     * @param target The target to check
     * @returns True if the target is an arch or false if not
     */
    archp(target: object): boolean;

    /** Array methods */
    arrays: Helpers.Arrays;

    /**
     * 
     * @param list The list of items to consolidate
     * @param useOr Use the word 'or' to construct the last sentence element (e.g. "a, b, or c")
     * @param consolidate Consolidate instances of the same substring (e.g. a, a, b, b, b, c becomes "two a's, three b's, and one c")
     * @param useNumbers If consolidated then use numbers instead of words (e.g. a, a, b, b, b, c becomes "2 a's, 3 b's, and 1 c")
     */
    arrayToSentence(list: object[] | string[], useOr: boolean, consolidate: boolean, useNumbers: boolean): string;

    /** Various file I/O helpers */
    readonly fs: Helpers.FileSystem;

    /** Various helpers for user I/O */
    readonly inputs: Helpers.Inputs;

    /** Various object helper methods */
    readonly objects: Helpers.Objects;

    /**
     * Determine the type of object
     * @param arg
     */
    objectType(arg: any): 'array' | 'function' | 'string' | 'number' | 'MudObject' | 'SimpleObject' | 'boolean' | 'undefined' | 'object';

    /**
     * Parse a path into components (e.g. /some/module$TypeName#instance)
     * @param arg
     */
    parsePath(arg: string): { file: string, type?: string, instance?: number };

    /**
     * Attempt to convert a partial MUD path into a fully-qualified MUD path.
     * @param expr The expression to resolve.
     * @param relativeToPath The relative directory to resolve from.
     * @returns The resolved directory
     */
    resolvePath(expr: string, relativeToPath?: string): string;

    /**
     * Restore a MUD object
     * @param dataOrFilename Either a file to restore from or data from a serialized object.
     */
    restoreObjectAsync(dataOrFilename: string | Object.<string, any>): MUDObject;
}

declare const efuns: EFUNProxy;

