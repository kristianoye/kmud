/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2020.  All rights reserved.
 * Date: January 27, 2020
 */

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

    /** Various helpers for living objects and players */
    readonly living: Helpers.Living;
    /**
     * Converts a display name into a normalized name (all lower case, no special characters)
     * @param name The name to convert
     */
    normalizeName(name: string): string;

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

