﻿/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    EventEmitter = require('events'),
    MUDCreationContext = require('./MUDCreationContext'),
    MUDStorage = require('./MUDStorage'),
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

var
    MUDData = require('./MUDData');

function getEfunProxy(t) {
    var fn = t.basename,
        module = MUDData.ModuleCache.get(fn),
        efuns = module ? module.efunProxy : false;
    return efuns;
}

function validIdentifier(s) {
    return typeof s === 'string' && s.length > 0 && s.indexOf(/\s+/) === -1;
}

function parseIdentifierList(args, mn) {
    var list = [];
    args.forEach(a => {
        if (Array.isArray(a)) {
            var b = a.filter(_ => validIdentifier(_));
            list.push(...b);
        }
        else if (validIdentifier(a))
            list.push(a);
    });
    if (list.length === 0) {
        throw new Error(`${mn}(): Zero valid entries found in parameter list.`);
    }
    return list;
}

/**
 * Base type for all MUD objects.
 */
class MUDObject extends EventEmitter {
    /**
     * Initialize the object instance with the context.
     * @param {MUDCreationContext} ctx
     */
    constructor(ctx) {
        super();
        var self = this, fn = false;

        if (ctx instanceof MUDCreationContext) {
            Object.defineProperties(this, {
                createTime: {
                    value: new Date().getTime(),
                    writable: false
                },
                instanceId: {
                    value: ctx.instanceId,
                    writable: false,
                    enumerable: true
                },
                _propKeyId: {
                    value: ctx.getKeyId(this),
                    writable: false,
                    enumerable: true
                }
            });
        }
        else {
            console.log('Illegal constructor call');
            throw new Error('Illegal constructor call');
        }

        if (this.filename && !MUDData.InstanceProps[this.filename])
            MUDData.SharedProps[this.basename] = {};

        ctx.$storage = MUDStorage.create(this, ctx);
    }

    addAction(verb, callback) {
        var _actions = this.getSymbol(_actions, {});
        if (_actions[verb]) delete _actions[verb];
        _actions[verb] = callback;
        return this;
    }

    addInventory(item) {
        var wrapped = wrapper(item),
            inv = MUDStorage.get(this).inventory;

        if (!wrapped) return false;
        else if (wrapped() === this) return false;

        item.emit('kmud.item.removed', item);
        item.removeAllListeners('kmud.item.removed');
        item.on('kmud.item.removed', o => {
            var _w = wrapper(o);
            if (_w) inv.removeValue(_w);
        });
        inv.push(wrapped);
        return true;
    }

    /**
     * Base objects are not containers.
     * @param {MUDObject} item The item being added to the container.
     * @returns {boolean} Always false
     */
    canAcceptItem(item) { return false; }

    create() {

    }

    /**
     * Destroys the object.
     * @param {boolean=} isReload Indicates the object was destructed as part of a reload.
     * @returns {MUDObject} The destroyed object.
     */
    destroy(isReload) {
        this.__destroyed = true;
        if (this.environment) this.emit('kmud.item.removed', this.environment);
        if (this.isPlayer()) {
            var wrapped = wrapper(this);
            MUDData.Players.removeValue(wrapped);
        }
        this.removeAllListeners();
        if (!isReload) {
            var fn = this.basename,
                mod = MUDData.ModuleCache.get(fn);
            MUDData.SafeCall(this, () => {
                return this.eventDestroy();
            });
            this.setSymbol(_environment, null);
            delete MUDStorage.instances[this._propKeyId];
            mod.destroyInstance(this);
        }
        return this;
    }

    enableHeartbeat(flag) {
        var callback = this.getSymbol(_heartbeat) || false,
            thisObject = global.wrapper(this);

        if (typeof this.eventHeartbeat !== 'function')
            throw new Error('Cannot call enableHeartbeat() on that object!');

        try {
            if (flag) {
                if (callback) {
                    MUDData.MasterObject.removeListener('kmud.heartbeat', callback);
                }
                callback = (ticks, total) => { this.eventHeartbeat(ticks, total); };
                this.setSymbol(_heartbeat, callback);
                MUDData.MasterObject.addListener('kmud.heartbeat', callback);
                MUDData.Livings.push(thisObject);
            }
            else {
                if (listener) MUDData.MasterObject.removeListener('kmud.heartbeat', callback);
                this.setSymbol(_heartbeat, false);
                MUDData.Livings.removeValue(thisObject);
            }
        }
        catch (e) {
            if (callback) {
                MUDData.MasterObject.off('kmud.heartbeat', callback);
            }
        }
    }

    get environment() {
        return unwrap(MUDStorage.get(this).environment);
    }

    evaluateProperty(key) {
        var prop = this.getProperty(key);
        if (typeof prop === 'function')
            return prop.call(this, key);
        else
            return prop;
    }

    eventDestroy() {

    }

    exportData() {
        var _props = MUDData.InstanceProps[this._propKeyId];
        return JSON.stringify(_props, undefined, 3);
    }

    get adjectives() {
        return this.getProperty('adjectives', []);
    }

    get id() {
        return this.getProperty('id', 'unknown');
    }

    get idList() {
        var result = this.getProperty('idList', []),
            id = this.id;
        if (result.indexOf(id) === -1)
            result.unshift(id);
        return result.slice(0);
    }

    get inventory() {
        return MUDStorage.get(this).inventory.map(o => unwrap(o));
    }

    get name() {
        return this.id;
    }

    getName() {
        return this.id;
    }

    getProperty(key, defaultValue) {
        return MUDStorage.get(this).getProperty(key, defaultValue);
    }

    getSharedProperty(key, defaultValue) {
        return MUDData.SharedProps[this.basename][key] || defaultValue;
    }

    incrementProperty(key, value, initialValue, callback) {
        return MUDStorage.get(this).incrementProperty(key, value, initialValue);
        if (typeof callback === 'function') callback.call(this, val, props[key]);
        return this;
    }

    init() {
    }

    isProtectedProperty(prop) {
        return false;
    }

    isLiving() {
        var callback = this.getSymbol(_heartbeat);
        return typeof callback === 'function';
    }

    isPlayer() {
        return false;
    }

    get keyId() {
        return MUDStorage.get(this).getProperty('id', 'unknown');
    }

    matchesId(words) {
        if (typeof words === 'string') words = words.split(/\s+/g);
        var idList = this.idList, adj = this.adjectives;
        for (var i = 0, max = words.length; i < max; i++) {
            if (adj.indexOf(words[i]) > -1) continue;
            else if (idList.indexOf(words[i]) === -1) return false;
        }
        return true;
    }

    matchesPluralId(words) {
        if (typeof words === 'string') words = words.split(/\s+/g);
        var adj = this.adjectives,
            plurals = this.pluralIds;

        for (var i = 0, max = words.length; i < max; i++) {
            if (adj.indexOf(words[i]) > -1) continue;
            else if (plurals.indexOf(words[i]) === -1) return false;
        }
        return true;
    }

    moveObject(destination, callback) {
        var environment = this.environment,
            efuns = getEfunProxy(this),
            target = wrapper(destination) || efuns.loadObject(destination);

        if (typeof target() !== 'object') {
            console.log('Unable to move object: Bad destination!');
            self.emit('kmud.item.badmove', destination);
        }
        else if (!environment || environment.canReleaseItem(this)) {
            var isAlive = this.isLiving();

            if (target().canAcceptItem(this)) {
                if (target().addInventory(this)) {
                    if (isAlive) {

                    }
                    MUDStorage.get(this).environment = target;
                    this.setSymbol(_environment, target);
                    if (isAlive) {
                        target().init.call(this);
                        isAlive = true;
                    }
                    target().inventory.forEach(p => {
                        if (p !== this && MUDData.SpecialRootEfun.isLiving(p)) {
                            this.init.call(p);
                        }
                        if (isAlive && p !== this) {
                            p.init.call(this);
                        }
                    });
                    if (typeof callback === 'function')
                        callback.apply(this, target);
                    return true;
                }
            }
        }
        return false;
    }

    get pluralIds() {
        var result = this.getProperty('pluralIdList', []);
        if (result.length === 0) {
            result = this.idList.map(id => MUDData.SpecialRootEfun.pluralize(id));
            this.setProperty('pluralIdList', result);
        }
        return result.slice(0);
    }

    receive_message(msgClass, text) {
    }

    serializeObject() {
        let $storage = MUDData.Storage.get(this);
        return $storage.serialize();
    }

    setAdjectives(adjectives) {
        var args = [].slice.apply(arguments),
            list = parseIdentifierList(args, 'setAdjectives');
        return this.setProperty('adjectives', list);
    }

    setIdList(identifiers) {
        var args = [].slice.apply(arguments),
            list = parseIdentifierList(args, 'setIdList');
        return this.setProperty('idList', list);
    }

    setContainer(target, cb) {
        var env = this.getSymbol(_environment),
            newEnv = wrapper(target),
            result = false;

        if (newEnv) {
            if (env && env !== newEnv)
                this.emit('kmud.item.removed', this.environment);
            this.removeAllListeners('kmud.item.removed');
            this.setSymbol(_environment, newEnv);
        }
        if (typeof cb === 'function') {
            cb.call(self, newEnv, env);
        }
        return this;
    }

    setKeyId(id) {
        if (typeof id !== 'string')
            throw new Error(`Bad argument 1 to setKeyId(); Expected string got ${typeof id}`);
        if (id.length === 0)
            throw new Error('Bad argument 1 to setKeyId(); Primary identifier cannot be zero length string.');
        if (id.indexOf(/\s+/))
            throw new Error('Bad argument 1 to setKeyId(); Primary identifier cannot contain whitespace.');
        this.setProperty('id', id);
        return this;
    }

    setProperty(key, value) {
        return MUDStorage.get(this).setProperty(key, value);
    }

    setSharedProperty(key, value) {
        MUDData.SharedProps[this.basename][key] = value;
        return this;
    }

    getSymbol(key, defaultValue) {
        return MUDStorage.get(this).getSymbol(key, defaultValue);
    }

    setSymbol(key, value) {
        return MUDStorage.get(this).setSymbol(key, value);
    }
}

MUDObject.prototype.restoreObject = function (path, callback) {
    var self = this,
        module = MUDData.ModuleCache.get(this.filename),
        efuns = module.efunProxy;
    filename = path + '.json';

    return efuns.readJsonFile(efuns.resolvePath(filename), (data, err) => {
        if (!err) {
            var props = MUDStorage.get(this).properties;
            for (var k in data) { props[k] = data[k]; }
            err = false;
        }
        if (typeof callback === 'function') callback.call(this, err);
    }), self;
};

MUDObject.prototype.saveObject = function (path, callback) {
    var module = MUDData.ModuleCache.get(this.filename),
        efuns = module.efunProxy,
        filename = efuns.resolvePath(path + '.json'),
        data = MUDStorage.get(this).properties,
        _async = typeof callback === 'function',
        saveData = {};

    for (var k in data) {
        var v = data[k], uw = unwrap(v);
        if (uw) {
            saveData[k] = uw.exportData();
        }
        else {
            saveData[k] = v;
        }
    }

    if (this.instanceId > 0)
        throw new ErrorTypes.SecurityError('Clones cannot use saveObject');

    return efuns.writeJsonFile(filename, saveData, (success) => {
        if (typeof callback === 'function')
            return callback(this, success), this;
        else return success;
    });
};

module.exports = MUDObject;
global.MUDObject = MUDObject;
