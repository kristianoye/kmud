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
                        value: efuns.ticks,
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
            //  Set this before going back up the constructor chain
            if (ecc.storage) {
                ecc.storage.owner = this;
                delete ecc.storage;
            }
        }
        finally {
            delete ecc.newContext;
            ecc.pop('constructor');
        }
    }

    get environment() {
        return unwrap(driver.storage.get(this).environment);
    }

    get destructed() {
        let store = driver.storage.get(this);
        if (store)
            return store.destroyed;
        else
            return true;
    }

    evaluateProperty(key) {
        var prop = this.getProperty(key);
        if (typeof prop === 'function')
            return prop.call(this, key);
        else
            return prop;
    }

    get inventory() {
        return driver.storage.get(this).inventory.map(o => unwrap(o));
    }

    isLiving() { return false; }

    isPlayer() { return false; }

    getPrivate(key, defaultValue) {
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
        let $storage = driver.storage.get(this);
        return $storage.getProtected(key, defaultValue);
    }

    init() {
    }

    isLiving() {
        var callback = this.getSymbol($heartbeat);
        return typeof callback === 'function';
    }

    isPlayer() {
        return false;
    }

    move(target) {

    }

    moveAsync(target) {

    }

    moveSync(target) {

    }

    moveObject(destination, callback) {
        let store = driver.storage.get(this),
            env = unwrap(store.environment);
        
            let target = wrapper(destination) ||
                efuns.loadObjectSync(destination),
                myWrapper = wrapper(this);

        if (!env || env.canReleaseItem(this)) {
            return unwrap(target, dest => {
                let targetStore = driver.storage.get(target);

                //  Can the destination accept the obejct?
                if (dest.canAcceptItem(this)) {

                    //  Do lazy reset if it's time
                    if (UseLazyResets) {
                        if (typeof dest.reset === 'function') {
                            if (targetStore.nextReset < efuns.ticks) {
                                driver.driverCall('reset', () => dest.reset(), dest.filename);
                            }
                        }
                    }

                    if (targetStore.addInventory(this)) {
                        if (this.isLiving()) {
                            let stats = targetStore.stats;
                            if (stats) stats.moves++;
                        }
                        if (this.isLiving()) {
                            target().init.call(this);
                        }
                        dest.inventory.forEach(p => {
                            if (p !== this && unwrap(p, (o) => o.isLiving())) {
                                this.init.call(p);
                            }
                            if (this.isLiving() && p !== this) {
                                p.init.call(this);
                            }
                        });
                        return true;
                    }
                }
                return false;
            });
        }
        return false;
    }

    preprocessInput(input, callback) {
        return callback(input);
    }

    receiveMessage(msgClass, text) {
        let store = driver.storage.get(this);
        if (store.client) {
            if (msgClass.startsWith('N'))
                store.client.write(text);
            else
                store.client.writeLine(text);
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
