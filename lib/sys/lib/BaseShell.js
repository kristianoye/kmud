/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 9, 2019
 * 
 * The basic command shell.  It executes commands.
 */

class BaseShell extends MUDObject {
    constructor(user) {
        super();

        register(':user', user);
    }

    /**
     * Splits a command into verb and arguments
     * @param {string} text The command to split
     * @returns {{ verb: string, args: string[], text: string, original: string }} The parsed data
     */
    static splitCommand(text) {
        return efuns.input.splitCommand(text, true);
    }

    /**
     * Does not do much except split the command
     * @param {string} text
     */
    processInput(text) {
        return BaseShell.splitCommand(text);
    }

    /**
     * The shell's user
     * @type {MUDObject} 
     */
    get user() {
        return get(':user');
    }
}

module.exports = BaseShell;
