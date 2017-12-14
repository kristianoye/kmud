/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var
    MUDData = require('./MUDData');

class MUDExecutionContext {
    constructor() {
        this.thisPlayer = MUDData.ThisPlayer;
        /** @type {MUDExecutionContext } */
        this.previousContext = MUDData.CurrentContext;
        this.objectStack = MUDData.ObjectStack;
    }

    run(callback) {
        try {
            this.previousContext = MUDData.CurrentContext;
            MUDData.CurrentContext = this;
            MUDData.ThisPlayer = this.thisPlayer;
            MUDData.ObjectStack = this.objectStack;
            if (typeof callback === 'function') callback();
        }
        catch (e) {
            MUDData.CleanError(e);
            throw e;
        }
        finally {
            this.restore();
        }
    }

    restore() {
        var prev = this.previousContext;
        if ((MUDData.CurrentContext = prev)) {
            MUDData.ThisPlayer = prev.thisPlayer;
            MUDData.ObjectStack = prev.objectStack;
        }
    }
}

module.exports = MUDExecutionContext;
