/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Extensions = require('./Extensions'),
    MUDCache = require('./MUDCache'),
    EFUNProxy = require('./EFUNProxy'),
    MUDData = require('./MUDData'),
    MUDCompiler = require('./MUDCompiler'),
    MUDObject = require('./MUDObject'),
    MUDCreationContext = require('./MUDCreationContext'),
    MUDLoader = require('./MUDLoader');


const
    ErrorTypes = require('./ErrorTypes'),
    async = require('async'),
    path = require('path'),
    os = require('os'),
    sprintf = require('sprintf').sprintf,
    util = require('util');
var
    _isGcOn = !!global.gc;


global.unwrap = function (target, success) {
    var result = false;
    if (typeof target === 'function' && target._isWrapper === true) {
        result = target() instanceof MUDObject ? target() : false;
    }
    else if (typeof target === 'object' && target instanceof MUDObject) {
        result = target;
    }
    return result === false ? false : (success ? success.call(this, result) : result);
};

global.wrapper = function (_o) {
    if (typeof _o === 'function' && _o._isWrapper === true) return _w;
    else if (typeof _o === 'object' && typeof _o.wrapper === 'function') return _o.wrapper;
    else if (_o instanceof MUDObject) {
        var module = MUDData.ModuleCache.get(_o.filename)
        if (module) return module.getWrapper(_o);
    }
    return false;
}

Object.defineProperty(global, 'master', {
    get: function () { return MUDData.InGameMaster; },
    set: function () { throw new Error('Access violation detected'); },
    configurable: true,
    enumerable: true
});

global.async = async;

/// <reference path="../lib/wwwroot/dts/global.d.ts" />
