/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDCreationContext = require('./MUDCreationContext'),
    MUDEventEmitter = require('./MUDEventEmitter'),
    $heartbeat = Symbol('_heartbeat'),
    callsite = require('callsite');

const
    GameServer = require('./GameServer');

var
    UseLazyResets = false;

function getEfunProxy(t) {
    let fn = t.basename,
        module = driver.cache.get(fn),
        efuns = module ? module.efuns : false;
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
class MUDObject extends MUDEventEmitter {
    constructor() {
        super();
        let ctx = false,
            ecc = driver.getExecution(this, 'constructor', this.__proto__.fileName, this.constructor);
        try {
            if (ecc && ecc.newContext) {
                ctx = ecc.newContext;
                delete ecc.newContext;
                Object.defineProperties(this, {
                    createTime: {
                        value: new Date().getTime(),
                        writable: false
                    },
                    filename: {
                        value: ctx.filename,
                        writable: false
                    },
                    instanceId: {
                        value: ctx.instanceId,
                        writable: false,
                        enumerable: true
                    },
                    isVirtual: {
                        value: ctx.isVirtual === true,
                        writable: false,
                        enumerable: false
                    }
                });
            }
            else {
                throw new Error(`Bad constructor setup for type ${this.constructor.name}`);
            }
            let store = ctx.$storage = global.driver.storage.create(this, ctx),
                mec = driver.getExecution(driver, 'create', this.filename, this.constructor);
            try {
                this.create(store);
            }
            finally {
                mec && mec.pop('create');
            }
        }
        finally {
            ecc.pop('constructor');
        }
    }

    addAction(verb, callback) {
        var _actions = this.getSymbol(_actions, {});
        if (_actions[verb]) delete _actions[verb];
        _actions[verb] = callback;
        return this;
    }

    addInventory(item) {
        var wrapped = wrapper(item),
            inv = driver.storage.get(this).inventory;

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

        if (this.environment)
            this.emit('kmud.item.removed', this.environment);

        if (this.isPlayer()) {
            driver.removePlayer(this);
        }
        this.removeAllListeners();
        if (!isReload) {
            var fn = this.basename,
                mod = driver.cache.get(fn);

            try {
                if (typeof this.eventDestroy === 'function')
                    this.eventDestroy();
                driver.storage.delete(this);
                mod.destroyInstance(this);
            }
            catch (e) {
                /* nothing to do here */
            }
        }
        return this;
    }

    enableHeartbeat(flag) {
        let callback = this.getSymbol($heartbeat) || false;
        let thisObject = global.wrapper(this),
            $storage = driver.storage.get(this);

        if (typeof this.heartbeat !== 'function')
            throw new Error('Cannot call enableHeartbeat() on that object!');

        try {
            let n = driver.heartbeatObjects.indexOf(this);
            if (flag) {
                if (n === -1) {
                    n = driver.heartbeatObjects.push(this);
                    driver.heartbeatStorage[n-1] = $storage;
                }
                if (callback) {
                    driver.removeListener('kmud.heartbeat', callback);
                }
                callback = (ticks, total) => {
                    let env = driver.storage.get($storage.environment);
                    this.heartbeat(ticks, total);
                    if (env && env.stats) {
                        env.stats.heartbeats++;
                    }
                };
                this.setSymbol($heartbeat, callback);
                driver.addListener('kmud.heartbeat', callback);
                driver.addLiving(thisObject);
            }
            else {
                if (n > -1) {
                    driver.heartbeatObjects.splice(n, 1);
                    delete driver.heartbeatStorage[n];
                }
                if (listener) driver.removeListener('kmud.heartbeat', callback);
                this.setSymbol($heartbeat, false);
                driver.removeLiving(thisObject);
            }
        }
        catch (e) {
            if (callback) {
                driver.off('kmud.heartbeat', callback);
            }
        }
    }

    get environment() {
        return unwrap(driver.storage.get(this).environment);
    }

    evaluateProperty(key) {
        var prop = this.getProperty(key);
        if (typeof prop === 'function')
            return prop.call(this, key);
        else
            return prop;
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
        return driver.storage.get(this).inventory.map(o => unwrap(o));
    }

    isLiving() { return false; }

    isPlayer() { return false; }

    get name() {
        return this.id;
    }

    getName() {
        return this.id;
    }

    getPrivate(key, defaultValue) {
        driver.getExecution().assertPrivate(this, 'method', 'getPrivate');
        let $storage = driver.storage.get(this);
        return $storage.getPrivate(this.filename, key, defaultValue);
    }

    getProperty(key, defaultValue) {
        return driver.storage.get(this)
            .getProperty(key, defaultValue);
    }

    /**
     * Set a protected value in the storage layer.
     * @param {string} key The name of the property to fetch.
     * @param {any} defaultValue The default value if the property does not exist.
     * @returns {any} The property value or default if not set.
     */
    getProtected(key, defaultValue) {
        driver.getExecution().assertProtected(this, 'method', 'getProtected');
        let $storage = driver.storage.get(this);
        return $storage.getProtected(key, defaultValue);
    }

    getSizeOf() {
        return driver.storage.get(this).getSizeOf();
    }

    incrementProperty(key, value, initialValue, callback) {
        return driver.storage.get(this)
            .incrementProperty(key, value, initialValue);
    }

    init() {
    }

    isProtectedProperty(prop) {
        return false;
    }

    isLiving() {
        var callback = this.getSymbol($heartbeat);
        return typeof callback === 'function';
    }

    isPlayer() {
        return false;
    }

    get keyId() {
        return driver.storage.get(this).getProperty('id', 'unknown');
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
            target = wrapper(destination) || efuns.loadObjectSync(destination);

        if (target && typeof target() !== 'object') {
            logger.log('Unable to move object: Bad destination!');
            self.emit('kmud.item.badmove', destination);
        }
        else if (!environment || environment.canReleaseItem(this)) {
            let $target = driver.storage.get(target);

            if (UseLazyResets) {
                if (typeof target().reset === 'function') {
                    if ($target.nextReset < new Date().getTime()) {
                        target().reset();
                        driver.registerReset(target, false, $target);
                    }
                }
            }
            if (target().canAcceptItem(this)) {
                if (target().addInventory(this)) {
                    let $storage = driver.storage.get(this);

                    if (this.isLiving()) {
                        let stats = $target.stats;
                        if (stats) stats.moves++;
                    }
                    $storage.environment = target;
                    if (this.isLiving()) {
                        target().init.call(this);
                    }
                    target().inventory.forEach(p => {
                        if (p !== this && unwrap(p, (o) => o.isLiving())) {
                            this.init.call(p);
                        }
                        if (this.isLiving() && p !== this) {
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
            result = this.idList.map(id => driver.efuns.pluralize(id));
            this.setProperty('pluralIdList', result);
        }
        return result.slice(0);
    }

    preprocessInput(input, callback) {
        return callback(input);
    }

    receiveMessage(msgClass, text) {
        let client = driver.storage.get(this)
            .getSymbol('$client');
        if (client) {
            if (msgClass.startsWith('N'))
                client.write(text);
            else
                client.writeLine(text);
        }
    }

    serializeObject() {
        let $storage = driver.storage.get(this);
        return $storage.serialize();
    }

    setAdjectives(adjectives) {
        var args = [].slice.call(arguments),
            list = parseIdentifierList(args, 'setAdjectives');
        return this.setProperty('adjectives', list);
    }

    setIdList(identifiers) {
        var args = [].slice.call(arguments),
            list = parseIdentifierList(args, 'setIdList');
        return this.setProperty('idList', list);
    }

    setContainer(target, cb) {
        let $storage = driver.storage.get(this),
            env = $storage.environment,
            newEnv = wrapper(target),
            result = false;

        if (newEnv) {
            if (env && env !== newEnv)
                this.emit('kmud.item.removed', this.environment);
            this.removeAllListeners('kmud.item.removed');
            $storage.environment = newEnv;
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

    /**
     * Private properties may only be set by this type or related-types
     * and they can only set/get data from their level in the inheritance
     * hierarchy.
     *
     * @param {string} key The name of the key to store.
     * @param {any} value Any associated value.
     * @returns {MUDObject} A reference to the object itself.
     */
    setPrivate(key, value) {
        driver.getExecution().assertPrivate(this, 'method', 'getPrivate');
        let s = driver.storage.get(this), fileName = this.filename;
        if (typeof key === 'object')
            Object.keys(key).forEach(name => s.setPrivate(fileName, name, key[name]));
        else
            s.setPrivate(fileName, key, value);
        return this;
    }

    setProperty(key, value) {
        let s = driver.storage.get(this);
        if (typeof key === 'object') 
            Object.keys(key).forEach(name => s.setProperty(name, key[name]));
        else
            s.setProperty(key, value);
        return this;
    }

    setProtected(key, value) {
        driver.getExecution().assertProtected(this, 'method', 'getPrivate');
        let $storage = driver.storage.get(this);
        $storage.setProtected(key, value);
        return this;
    }

    getSymbol(key, defaultValue) {
        let store = driver.storage.get(this);
        return store ? store.getSymbol(key, defaultValue) : undefined;
    }

    setSymbol(key, value) {
        let storage = driver.storage.get(this);
        storage && storage.setSymbol(key, value);
        return this;
    }
}

const $blockedMethods = ['constructor', '$extendType', '$copyMethods'];

class MUDMixin {
}

MUDMixin.$copyMethods = function (type, proto, listOrMethod) {
    let filter = listOrMethod || function (s) { return s !== 'constructor'; };
    if (Array.isArray(listOrMethod)) {
        filter = function (s) { return listOrMethod.indexOf(s) > -1; };
    }
    let methodList = Object.getOwnPropertyNames(proto)
        .filter(s => typeof proto[s] === 'function' && filter(s) && $blockedMethods.indexOf(s) === -1);

    methodList
        .forEach(mn => {
            if (typeof type.prototype[mn] === 'undefined')
                type.prototype[mn] = proto[mn];
        });
};

MUDMixin.$extendType = function (type, mixin) {
    if (!mixin)
        throw new Error('Invalid mixin type');
    MUDMixin.$copyMethods(type, mixin.prototype);
};

module.exports = MUDObject;
global.MUDObject = MUDObject;
global.MUDMixin = MUDMixin;
