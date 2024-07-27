/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDEventEmitter = require('./MUDEventEmitter');

class SimpleObject extends MUDEventEmitter {
    constructor(...args) {
        super();
        this.create(...args);
    }

    create() { }
}

global.SimpleObject = SimpleObject;

module.exports = SimpleObject;
