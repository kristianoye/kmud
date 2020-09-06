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
         * Check to see if an expression is a directory
         * @param expr The path to check
         */
        isDirectoryAsync(expr: string): Promise<boolean>;

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
     * Restore a MUD object
     * @param dataOrFilename Either a file to restore from or data from a serialized object.
     */
    restoreObjectAsync(dataOrFilename: string | Object.<string, any>): MUDObject;
}

declare const efuns: EFUNProxy;

