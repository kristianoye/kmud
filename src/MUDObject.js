/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    events = require('events');

var
    UseLazyResets = false;

/**
 * Base type for all MUD objects.
 */
class MUDObject extends events.EventEmitter {
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

    __callScopedImplementation(methodName, scopeName, ...args) {
        return MUDVTable.virtualCall(this, methodName, scopeName, args);
    }

    async __callScopedImplementationAsync(methodName, scopeName, ...args) {
        return await MUDVTable.virtualCallAsync(this, methodName, scopeName, args);
    }

    __exportScopedProperty(propName, scopeId) {
        return MUDVTable.exportScopedProperty(this, propName, scopeId);
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
    VTE_TYPE = Object.freeze({
        Method: 1,
        Property: 2
    });

var
    VirtualTables = {};
    
class MUDVTable {
    constructor(baseName) {
        this.baseName = baseName;
        this.inheritedTypes = [];
        this.methods = {};
        this.properties = {};
        this.scopeAliases = {};
    }

    addInheritedType(inheritedType, alias = false) {
        if (this.inheritedTypes.indexOf(inheritedType) === -1) {
            this.inheritedTypes.push(inheritedType);
            return true;
        }
        return false;
    }

    addMethod(typeName, methodName, implementation, depth = 1) {
        let methodMap = this.methods[methodName] || false;
        if (false === methodMap) {
            this.methods[methodName] = methodMap = {};
        }
        methodMap[typeName] = {
            type: VTE_TYPE.Method,
            implementation,
            depth
        };
    }

    addProperty(typeName, propName, implementation, depth = 1) {
        let propMap = this.properties[propName] || false;
        if (false === propMap) {
            this.properties[propName] = propMap = {};
        }
        propMap[typeName] = {
            type: VTE_TYPE.Property,
            implementation,
            depth
        };
    }

    getMethod(methodName) {
        return this.methods[methodName] || void 0;
    }

    inherits(targetType) {
        return this.inheritedTypes.indexOf(targetType) > -1;
    }

    //#region Static Methods

    static doesInherit(typeOrInstance, targetType) {
        if (typeOrInstance instanceof targetType)
            return true;
        else if (!typeOrInstance.baseName) {
            return MUDVTable.doesInherit(Object.getPrototypeOf(typeOrInstance), targetType);
        }
        let vtable = MUDVTable.getVirtualTable(typeOrInstance);
        return vtable && vtable.inherits(targetType);
    }

    static extendType(type, inheritedType) {
        MUDVTable.inheritType(type, inheritedType);
        return type;
    }

    static exportScopedProperty(instance, propName, scopeName) {
        let $vt = MUDVTable.getVirtualTable(instance);
    }

    /**
     * Get a virtual table 
     * @param {MUDObject|class} proto
     * @param {boolean} createIfMissing
     * @returns {MUDVTable}
     */
    static getVirtualTable(proto, createIfMissing = false) {
        if (typeof proto.baseName !== 'string')
            return false;

        let results = VirtualTables[proto.baseName] || false;

        if (false === results) {
            if (proto === MUDObject.prototype)
                return undefined;
            else if (createIfMissing === true) 
                return (VirtualTables[proto.baseName] = new MUDVTable(proto.baseName));
        }
        else
            return results;
        throw new Error(`Could not find virtual table for type '${proto.constructor.name}'`);
    }

    static inheritType(type, addedType) {
        let vtable = MUDVTable.getVirtualTable(type.prototype, true),
            addedTypeName = addedType.name,
            addedTypeProto = addedType.prototype,
            addedTypeVTable = MUDVTable.getVirtualTable(addedTypeProto);

        if (!vtable)
            return false;

        vtable.addInheritedType(addedType);

        if (addedTypeVTable) {
            for (const inheritedType of addedTypeVTable.inheritedTypes) {
                if (vtable.addInheritedType(inheritedType)) {
                    for (const [methodName, methodTable] of Object.entries(addedTypeVTable.methods)) {
                        for (const [definingType, methodInfo] of Object.entries(methodTable)) {
                            vtable.addMethod(definingType, methodName, methodInfo.implementation, methodInfo.depth + 1);
                        }
                    }
                    for (const [propName, propTable] of Object.entries(addedTypeVTable.properties)) {
                        for (const [definingType, propInfo] of Object.entries(propTable)) {
                            vtable.addMethod(definingType, propName, propInfo.implementation, propInfo.depth + 1);
                        }
                    }
                }
            }
        }

        let propertyList = Object.getOwnPropertyNames(addedTypeProto)
            .filter(s => s !== 'constructor')
            .map(s => [s, Object.getOwnPropertyDescriptor(addedTypeProto, s)])
            .filter(s => !!s);

        for (const info of propertyList) {
            let [name, prop] = info;

            if (!type.prototype.hasOwnProperty(name) && !type.prototype.__proto__.hasOwnProperty(name)) {
                Object.defineProperty(type.prototype, name, prop);
            }
            if (typeof prop.value === 'function' && name !== 'constructor')
                vtable.addMethod(addedTypeName, name, prop.value);
            else if (prop.hasOwnProperty('get') && prop.hasOwnProperty('set'))
                vtable.addProperty(addedTypeName, name, prop);
        }
        return true;
    }

    static virtualCall(instance, methodName, typeName, args) {
        const vtable = MUDVTable.getVirtualTable(instance.constructor.prototype),
            methodMap = vtable.getMethod(methodName);

        if (!methodMap)
            throw new Error(`Type ${instance.constructor.name} does not have a method named '${methodName}'`)
        else if (typeName && !methodMap[typeName])
            throw new Error(`Type '${typeName}', inherited by ${instance.constructor.name}, does not have a method named '${methodName}'`)
        else if (typeName) {
            return methodMap[typeName].implementation.apply(instance, args);
        }
        else {
            let result = {};
            for (const [scopeName, method] of Object.entries(methodMap)) {
                if (method.depth === 1)
                    result[scopeName] = method.implementation.apply(instance, args);
            }
            return result;
        }
    }

    static async virtualCallAsync(instance, methodName, typeName, args) {
        const vtable = MUDVTable.getVirtualTable(instance),
            methodMap = vtable.getMethod(methodName);

        if (!methodMap)
            throw new Error(`Type ${instance.constructor.name} does not have a method named '${methodName}'`)
        else if (typeName && !methodMap[typeName])
            throw new Error(`Type '${typeName}', inherited by ${instance.constructor.name}, does not have a method named '${methodName}'`)
        else if (typeName) {
            return await methodMap[typeName].implementation.apply(instance, args);
        }
        else {
            let result = {};
            for (const [scopeName, method] of Object.entries(methodMap)) {
                if (method.depth === 1)
                    result[scopeName] = await method.implementation.apply(instance, args);
            }
            return result;
        }
    }

    //#endregion
}

module.exports = MUDObject;

global.MUDObject = MUDObject;
global.MUDVTable = MUDVTable;
