/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDEventEmitter = require('./MUDEventEmitter');

var
    UseLazyResets = false;

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
        let store = driver.storage.get(this);
        return !!store && store.environment;
    }

    get destructed() {
        let store = driver.storage.get(this);
        if (store)
            return store.destroyed;
        else
            return true;
    }

    get inventory() {
        let store = driver.storage.get(this);
        return !!store && store.inventory;
    }

    init() {}

    move(target) {}

    moveAsync(target) {}

    moveSync(target) {}

    /**
     * Move this object to a new environment
     * @param {string|MUDObject|MUDWrapper} destination The destination
     * @returns {boolean} True on a successful move
     */
    moveObject(destination) {
        let myStore = driver.storage.get(this),
            oldEnvironment = myStore.environment;
        
        let target = efuns.loadObjectSync(destination),
            newEnvironment = unwrap(target);

        if (!oldEnvironment || oldEnvironment.canReleaseItem(this) && newEnvironment) {
            let targetStore = driver.storage.get(newEnvironment);
            //  Can the destination accept this object?
            if (targetStore && newEnvironment.canAcceptItem(this)) {

                //  Do lazy reset if it's time
                if (UseLazyResets) {
                    if (typeof newEnvironment.reset === 'function') {
                        if (targetStore.nextReset < efuns.ticks) {
                            driver.driverCall('reset',
                                () => newEnvironment.reset(),
                                newEnvironment.filename);
                        }
                    }
                }

                if (targetStore.addInventory(this)) {
                    if (myStore.living) {
                        let stats = targetStore.stats;
                        if (stats) stats.moves++;
                        target().init.call(this);
                    }
                    newEnvironment.inventory.forEach(item => {
                        if (item !== this && efuns.living.isAlive(item)) {
                            this.init.call(item);
                        }
                        if (myStore.living && item !== this) {
                            item.init.call(this);
                        }
                    });
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
