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

        let ecc = driver.getExecution(this, 'constructor', this.__proto__.fileName, this.constructor);
        try {
            if (ecc && ecc.newContext) {
                let ctx = ecc.newContext;
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
        }
        finally {
            delete ecc.newContext;
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

    get inventory() {
        return driver.storage.get(this).inventory.map(o => unwrap(o));
    }

    isLiving() { return false; }

    isPlayer() { return false; }

    get name() {
        return this.getPrivate('name', 'OBJECT');
    }

    set name(value) {
        if (typeof value !== 'string')
            throw new Error(`Invalid value for "name"; Must be string not ${typeof value}`);
        this.setPrivate('name', value);
    }

    getFirstProperty(...propList) {
        let store = driver.storage.get(this),
            evalFunctions = false,
            value = undefined;
        if (!store) return undefined;
        for (let i = 0; i < propList.length; i++) {
            if (i === 0 && propList[i] === true) {
                evalFunctions = true;
            }
            value = store.getProperty(propList[i]);
            if (typeof value !== 'undefined') break;
        }
        if (typeof value !== 'undefined') {
            if (typeof value === 'function' && evalFunctions)
                return value();
            return value;
        }
        return undefined;
    }

    getPrivate(key, defaultValue) {
        driver.getExecution().assertPrivate(this, 'method', 'getPrivate');
        let $storage = driver.storage.get(this);
        return $storage.getPrivate(this.filename, key, defaultValue);
    }

    getProperty(key, defaultValue, evalFunctions = false) {
        let value = driver.storage.get(this).getProperty(key, defaultValue, evalFunctions);
        if (evalFunctions && typeof value === 'function') return value();
        return value;
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

    moveObject(destination, callback) {
        var environment = this.environment,
            efuns = driver.efuns,
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

    get wrapper() {
        let parts = driver.efuns.parsePath(this.filename),
            module = driver.cache.get(parts.file);
        return module && module.getInstanceWrapper(parts);
    }

    write(msg) {
        let storage = driver.storage.get(this),
            client = storage.client;

        if (client) {
            client.write(msg || '');
        }
        return this;
    }

    writeLine(msg) {
        return this.write(msg + '\n');
    }

    writePrompt(data, cb) {
        let storage = driver.storage.get(this),
            client = storage.client;

        if (client) {
            client.addPrompt(data, cb);
        }
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
