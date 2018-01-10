/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Extensions = require('./Extensions');

Object.defineProperty(global, 'master', {
    value: function () { return driver.masterObject; },
    writable: false
});

/// <reference path="../lib/wwwroot/dts/global.d.ts" />
