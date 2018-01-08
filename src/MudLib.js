/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Extensions = require('./Extensions'),
    MUDObject = require('./MUDObject');

Object.defineProperty(global, 'master', {
    get: function () { return MUDData.InGameMaster; },
    set: function () { throw new Error('Access violation detected'); },
    configurable: true,
    enumerable: true
});

/// <reference path="../lib/wwwroot/dts/global.d.ts" />
