/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDEventEmitter = require('./MUDEventEmitter');

const
    symMixinVTable = Symbol('symMixinVTable');

var
    UseLazyResets = false;

/**
 * Base type for all MUD objects.
 */
class MUDObject extends MUDEventEmitter {
    constructor() {
        super();

        if (!new.target)
            throw new Error('Illegal constructor call');

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
                    },
                    objectId: {
                        value: ctx.uuid,
                        writable: false,
                        enumerable: true
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
            ecc.popCreationContext();
            ecc.pop('constructor');
            Object.freeze(this);
        }
    }

    callMixinImpl(methodName, mixinName, ...args) {
        return MUDMixin.$__virtualCall(this, methodName, mixinName, args);
    }

    async callMixinImplAsync(methodName, mixinName, ...args) {
        return await MUDMixin.$__virtualCallAsync(this, methodName, mixinName, args);
    }

    create(...args) {
    }

    async createAsync(...args) {
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

    get $credential() {
        let store = driver.storage.get(this);
        return !!store && store.getSafeCredential();
    }

    get directory() {
        let parts = efuns.parsePath(this.filename),
            dir = parts.file.slice(0, parts.file.lastIndexOf('/'));
        return dir;
    }

    get inventory() {
        let store = driver.storage.get(this);
        return !!store && store.inventory;
    }

    init() { }

    initAsync() { }

    moveObject(destination) {
        let myStore = driver.storage.get(this),
            oldEnvironment = myStore.environment;

        let target = unwrap(destination) || efuns.loadObject(destination),
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
        if (store.component) {
            if (msgClass.startsWith('N'))
                store.component.write(text);
            else
                store.component.writeLine(text);
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
            shell = storage.shell,
            stdio = shell && shell.stdout;

        if (shell) {
            stdio.write(msg || '');
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

const
    $blockedMethods = ['constructor', '$__extendType', '$__copyMethods', '$__getVirtualTable', '$__virtualCall', '$__virtualCallAsync'];

class MUDMixin {
    static $__copyMethods(type, proto, listOrMethod) {
        let filter = listOrMethod || function (s) { return s !== 'constructor'; },
            mixinName = proto.constructor.name;

        if (Array.isArray(listOrMethod)) {
            filter = function (s) { return listOrMethod.indexOf(s) > -1; };
        }
        let methodList = Object.getOwnPropertyNames(proto)
            .filter(s => filter(s) && $blockedMethods.indexOf(s) === -1)
            .map(s => [s, Object.getOwnPropertyDescriptor(proto, s)])
            .filter(s => !!s);

        if (typeof type.prototype[symMixinVTable] !== 'object')
            type.prototype[symMixinVTable] = {};

        type.prototype[symMixinVTable][mixinName] = {};

        for (const info of methodList) {
            let [name, prop] = info;

            if (!type.prototype.hasOwnProperty(name) && !type.prototype.__proto__.hasOwnProperty(name)) {
                Object.defineProperty(type.prototype, name, prop);
            }
            if (typeof prop.value === 'function')
                type.prototype[symMixinVTable][mixinName][name] = prop.value;
        }
    }

    static $__extendType(type, mixin) {
        if (!mixin)
            throw new Error('Invalid mixin type');
        MUDMixin.$__copyMethods(type, mixin.prototype);
        return type;
    }

    static $__getVirtualTable(proto) {
        let results = proto[symMixinVTable] || {};
        
        if (proto.constructor.name !== 'MUDEventEmitter') {
            results = Object.assign(this.$__getVirtualTable(proto.__proto__), results);
        }
        return results;
    }

    static $__virtualCall(instance, methodName, mixinName, args) {
        let $vt = MUDMixin.$__getVirtualTable(instance.constructor.prototype),
            $vtSize = Object.keys($vt).length;

        if (!mixinName)
            throw new Error(`$__virtualCall(): Missing required parameter 3: mixinName`);

        if ($vtSize > 0 && typeof methodName === 'string') {
            let mixinList = (mixinName ? [$vt[mixinName]] : Object.keys($vt))
                .filter(m => typeof m === 'string')
                .map(m => $vt[m]),
                results = [];

            if (mixinList.length === 0 && mixinName)
                throw new Error(`Type '${instance.constructor.name}'' does not inherit mixin named '${mixinName}'`);

            for (const table of mixinList) {
                if (typeof table[methodName] === 'function') {
                    results.push(table[methodName].apply(instance, args));
                }
                else if (typeof table[methodName] !== 'undefined') {
                    results.push(table[methodName]);
                }
                else if (mixinName) {
                    throw new Error(`Type '${instance.constructor.name}'' method not found: '${mixinName}.${methodName}'`);
                }
                else {
                    results.push(undefined);
                }
            }

            return mixinName ? results[0] : results;
        }
    }

    static async $__virtualCallAsync(instance, methodName, mixinName, args) {
        let $vt = MUDMixin.$__getVirtualTable(instance.constructor.prototype),
            $vtSize = Object.keys($vt).length;

        if (!mixinName)
            throw new Error(`$__virtualCallAsync(): Missing required parameter 3: mixinName`);

        if ($vtSize > 0 && typeof methodName === 'string') {
            let mixinList = (mixinName ? [$vt[mixinName]] : Object.keys($vt))
                .filter(m => typeof m === 'object'),
                results = [];

            if (mixinList.length === 0 && mixinName)
                throw new Error(`Type '${instance.constructor.name}'' does not inherit mixin named '${mixinName}'`);

            for (const table of mixinList) {
                if (typeof table[methodName] === 'function') {
                    if (driver.efuns.isAsync(table[methodName]))
                        results.push(await table[methodName].apply(instance, args));
                    else
                        results.push(table[methodName].apply(instance, args));
                }
                else if (typeof table[methodName] !== 'undefined') {
                    results.push(table[methodName]);
                }
                else if (mixinName) {
                    throw new Error(`Type '${instance.constructor.name}'' method not found: '${mixinName}.${methodName}'`);
                }
            }

            return mixinName ? results[0] : results;
        }
    }
}

module.exports = MUDObject;
global.MUDObject = MUDObject;
global.MUDMixin = MUDMixin;
