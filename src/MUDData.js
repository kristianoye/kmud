/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Shared globals?!  Don't judge me!!
 *
 * This module contains "global" data shared by driver objects.  Do not
 * touch this unless you know what you're doing :)
 */
const
    path = require('path'),
    ErrorTypes = require('./ErrorTypes');

var MUDData = {
    Constants: {
        GAMESTATE_STARTING: 1,
        GAMESTATE_INITIALIZING: 2,
        GAMESTATE_RUNNING: 3,
        GAMESTATE_SHUTDOWN: 4
    },
    ActivePerms: false,
    BoundActions: {},
    CleanError: function (e) {
        var s = e.stack,
            p = s.indexOf(MUDData.MudlibPath),
            v = /[a-zA-Z0-9\\\/\._]/;
        while (p > -1) {
            var chunk = s.slice(p, s.indexOf(':', p + MUDData.MudlibPath.length));
            for (var i = 3; i < chunk.length; i++) {
                if (!chunk.charAt(i).match(v)) break;
            }
            var repl = chunk.slice(0, i).replace(/\\\//g, path.sep);
            if (s.indexOf(repl) === -1) {
                console.log('Could not clean stack trace; Giving up...');
                break;
            }
            s = s.replace(repl, MUDData.RealPathToMudPath(repl));
            p = s.indexOf(MUDData.MudlibPath);
        }
        p = s.indexOf(MUDData.DriverPath);
        while (p > -1) {
            s = s.replace(MUDData.DriverPath, '[driver]');
            p = s.indexOf(MUDData.DriverPath);
        }
        e.stack = s;
        return e;
    },
    Clients: [],
    Compiler: function () {
        var args = [].slice.apply(arguments);
        return MUDData.CompilerInstance.compileObject.apply(MUDData.CompilerInstance, args);
    },
    CompilerInstance: false,
    Config: false,
    DriverPath: path.resolve('src'),
    ErrorTypes: ErrorTypes,
    GameState: 0,
    InGameMaster: false,
    InstanceProps: {},
    InstanceSymbols: {},
    Livings: [],
    MasterEFUNS: false,
    MasterObject: false,
    ModuleCache: false,
    MudPathToRealPath: function (fileexp) {
        return path.resolve(MUDData.MudlibPath,
            fileexp.startsWith('/') ? fileexp.substr(1) : fileexp);
    },
    MudlibPath: path.resolve('lib'),
    ObjectStack: [],
    Players: [],
    PushStack: function (o, callback) {
        var result;
        try {
            MUDData.ObjectStack.unshift(o);
            result = callback.apply(o);
            MUDData.ObjectStack.shift();
        }
        catch (x) {
            MUDData.ObjectStack.shift();
            if (MUDData.ObjectStack.length === 0)
                console.log('Object stack back to zero');
            throw x;
        }
        return result;
    },
    RealPathToMudPath: function (fileexp) {
        return '/' + path.relative(MUDData.MudlibPath, fileexp).replace(/\\/g, '/');
    },
    SafeCall: function (thisObject, callback) {
        var result, args = [].slice.call(arguments, 2);
        try {
            result = callback.apply(thisObject, args);
        }
        catch (e) {
            result = MUDData.CleanError(e);
        }
        return result;
    },
    SharedProps: {},
    SpecialRootEfun: false,
    StorageObjects: {},
    ThisObject: [],
    ThisPlayer: false
};

module.exports = MUDData;
