/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var
    MUDData = require('./MUDData');

class MUDExecutionContext {
    constructor(currentObject) {
        if (currentObject) {
            this.player = MUDData.ThisPlayer;
            this.previous = currentContext;
            this.permStack = currentObject.permissions;
            this.thisObject = currentObject;
        }
    }

    restore(callback) {
        var current = currentContext;
        try {
            MUDData.ThisPlayer = this.player;
            if (typeof callback === 'function') callback();
            currentContext = current;
        }
        catch (e) {
            currentContext = current;
            throw e;
        }
    }

    release() {
        currentContext = this.previous;
    }
}

module.exports = MUDExecutionContext;
