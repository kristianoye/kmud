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
    declare interface Arrays {
        /**
         * Determine the intersection of two or more arrays
         * @param arrays
         */
        intersection(...arrays: any[]): any[];
    }

    declare interface Inputs {
        /**
         * Render a prompt for the user and redirect the response to the specified callback
         * @param type The type of input to render
         * @param options Additional options to pass to the 
         * @param callback
         */
        addPrompt(type: InputType, options: any, callback: (input: string) => void): void;
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

    static arrays: Helpers.Arrays;

    static inputs: Helpers.Inputs;
}

declare const efuns: EFUNProxy;
