/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    _actions = Symbol('_actions'),
    EventEmitter = require('events'),
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
    ClientEndpoint = require('./network/ClientEndpoint'),
    HTTPClientEndpoint = require('./network/HTTPClientEndpoint'),
    TelnetClientEndpoint = require('./network/TelnetClientEndpoint'),
    stack = require('callsite'),
    async = require('async'),
    path = require('path'),
    os = require('os'),
    sprintf = require('sprintf').sprintf,
    util = require('util');
var
    _isGcOn = !!global.gc;

const
    _environment = Symbol('_environment'),
    _filename = '_filename',  // Symbol('_filename'),
    _heartbeat = Symbol('_heartbeat'),
    _inventory = Symbol('_inventory'),
    _living = Symbol('_living'),
    _permissions = '_permissions', // Symbol('_permissions'),
    _properties = '_properties',
    _module = '_module', // Symbol('_module'),
    _symbols = '_symbols',
    _thisId = '_thisId', // Symbol('_thisId')
    _unguarded = '_unguarded'; // Symbol('_unguarded');

function setThisObjectForRoot(cb) {
    try {
        MUDData.ThisObject.push(MUDData.SpecialRootEfun);
        if (typeof cb === 'function') cb();
    }
    catch (e) {
        console.log('error: ' + e);
        console.log(e.stack || e.trace);
    }
    MUDData.ThisObject.pop();
}

Object.defineProperty(global, 'getPermissions', {
    get: function () {
        return function (target) {
            var o = unwrap(target || MUDData.ThisPlayer);
            if (o) {
                target = o.filename;
            }
            if (typeof target === 'string') {
                var module = MUDData.ModuleCache.get(target);
                if (!module) {
                    if (!compileObject(target))
                        return false;
                    module = MUDData.ModuleCache.get(target);
                }
                if (module && module.efunProxy)
                    return module.efunProxy.permissions.slice(0);
            }
            return false;
        }
    },
    enumerable: true,
    configurable: false
});

Object.defineProperty(global, 'thisObject', {
    get: function () {
        return function (target) { return MUDData.ThisObject; }
    },
    enumerable: true,
    configurable: false
});

global.unwrap = function (target, success) {
    var result = false;
    if (typeof target === 'function' && target._isWrapper === true) {
        result = target() instanceof MUDObject ? target() : false;
    }
    else if (typeof target === 'object' && target instanceof MUDObject) {
        result = target;
    }
    return target === false ? false : (success ? success(result) : result);
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

Object.defineProperty(global, 'thisPlayer', {
    get: function () {
        return MUDData.ThisPlayer;
    },
    set: function () { },
    configurable: true,
    enumerable: true
});

global.EventEmitter = EventEmitter;
global.async = async;

/// <reference path="../lib/wwwroot/dts/efuns.d.ts" />
