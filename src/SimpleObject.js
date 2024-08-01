/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDEventEmitter = require('./MUDEventEmitter');

class SimpleObject extends MUDEventEmitter {
    constructor(ecc, ...args) {
        let frame = ecc.pushFrameObject({ method: 'constructor' });
        try {
            super();
            this.create(frame.context, ...args);
        }
        finally {
            frame.pop();
        }
    }

    create(ecc) {
        ecc.used = true;
    }
}

global.SimpleObject = SimpleObject;

module.exports = SimpleObject;
