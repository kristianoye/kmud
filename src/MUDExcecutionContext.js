/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var
    MUDData = require('./MUDData');

class MUDExecutionContext {
    constructor() {
        this.thisObject = MUDData.ThisObject;
        this.thisPlayer = MUDData.ThisPlayer;
        this.thisVerb = MUDData.ThisVerb;

        this.truePlayer = MUDData.TruePlayer;

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

MUDExecutionContext.awaiter = function (callback) {
    if (!callback)
        return callback;

    let context = new MUDExecutionContext();

    context.previousContext = MUDData.CurrentContext;
    MUDData.CurrentContext = context;
    MUDData.ThisPlayer = context.thisPlayer;
    MUDData.ObjectStack = context.objectStack;

    return function (...args) {
        try {
            context.run(() => callback(...args));
        }
        finally {
            context.restore();
        }
    };
};


module.exports = MUDExecutionContext;
