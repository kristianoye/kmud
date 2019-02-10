/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 9, 2019
 * 
 * The basic command shell.  It executes commands.
 */

class BaseShell extends MUDObject {
    /**
     * Does not do much
     * @param {MUDInputEvent} evt
     */
    processInput(evt) { return [evt]; }
}

module.exports = BaseShell;
