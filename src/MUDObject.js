/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const { ExecutionContext, CallOrigin } = require('./ExecutionContext');
const
    MUDEventEmitter = require('./MUDEventEmitter');

/**
 * Base type for all MUD objects.
 * @property {MUDWrapper} wrapper
 */
class MUDObject extends MUDEventEmitter {
    /**
     * 
     * @param {import('./MUDModule').CreationContext} ctx Initialization values for this objects
     * @param {ExecutionContext} ecc The current callstack
     */
    constructor(ctx, ecc) {
        super();

        if (!new.target)
            throw new Error('Illegal constructor call');
        const
            frame = ecc.push({ object: this, method: 'constructor', callType: CallOrigin.Constructor });

        try {
            if (ctx) {
                Object.defineProperties(this, {
                    createTime: {
                        value: ctx.createTime,
                        writable: false,
                        enumerable: true
                    },
                    filename: {
                        value: ctx.filename,
                        writable: false,
                        enumerable: true
                    },
                    fullPath: {
                        value: ctx.fullPath,
                        writable: false,
                        enumerable: true
                    },
                    identity: {
                        value: ctx.identity,
                        writable: false,
                        enumerable: true
                    },
                    instance: {
                        get: () => this,
                        enumerable: false
                    },
                    isVirtual: {
                        value: ctx.isVirtual === true,
                        writable: false,
                        enumerable: false
                    },
                    isWrapper: {
                        value: false,
                        writable: false,
                        enumerable: false
                    },
                    objectId: {
                        value: ctx.objectId,
                        writable: false,
                        enumerable: true
                    },
                    wrapper: {
                        value: ctx.wrapper,
                        writable: false,
                        enumerable: false
                    }
                });

                if (ctx.trueName) {
                    Object.defineProperties(this, {
                        trueName: {
                            value: ctx.trueName.slice(0),
                            writable: false,
                            enumerable: false
                        }
                    });
                }
            }
            //  Set this before going back up the constructor chain
            if (ctx.store) {
                ctx.store.owner = this;
            }
        }
        finally {
            ecc.popCreationContext();
            Object.freeze(this);
            frame.pop();
        }
    }

    __callScopedImplementation(ecc, methodName, scopeName, ...args) {
        return MUDVTable.virtualCall(this, ecc, methodName, scopeName, args);
    }

    async __callScopedImplementationAsync(methodName, scopeName, ...args) {
        return await MUDVTable.virtualCallAsync(this, methodName, scopeName, args);
    }

    __exportScopedProperty(propName, scopeId) {
        return MUDVTable.exportScopedProperty(this, propName, scopeId);
    }

    create(ecc, ...args) {
        let frame = ecc && ecc.push({ method: 'create' });
        frame?.pop();
    }

    setup(ecc, ...args) {
        let frame = ecc && ecc.push({ method: 'setup' });
        frame?.pop();
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

    /**
     * Get the object's security credential from the security manager
     * @returns {import('./security/BaseSecurityManager').BaseSecurityCredential}
     */
    getCredential() {
        const [frame, refresh] = ExecutionContext.tryPushFrame(arguments, { object: this, method: 'getCredential' }, true);
        try {
            return driver.securityManager.getSafeCredential(frame.context, this.identity, refresh === true);
        }
        finally {
            frame.pop();
        }
    }

    get directory() {
        let parts = efuns.parsePath(undefined, this.filename),
            dir = parts.file.slice(0, parts.file.lastIndexOf('/'));
        return dir;
    }

    id(word) {
        return false;
    }

    get inventory() {
        let store = driver.storage.get(this);
        return !!store && store.inventory;
    }

    async initAsync(ecc) {
        let frame = ecc && ecc.push({ method: 'initAsync' });
        frame?.pop();
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} destination
     * @returns
     */
    async moveObjectAsync(ecc, destination) {
        let frame = ecc.push({ object: this, file: __filename, method: 'moveObjectAsync', isAsync: true, callType: 2, lineNumber: 154 });
        try {
            let myStore = driver.storage.get(this),
                oldEnvironment = myStore.environment;

            let target = destination.instance || await efuns.objects.loadObjectAsync(frame.branch(159), destination),
                newEnvironment = target && target.instance;

            if (!oldEnvironment || oldEnvironment.canReleaseItem(frame.context, this) && newEnvironment) {
                let targetStore = driver.storage.get(newEnvironment);

                //  Can the destination accept this object?
                if (targetStore && newEnvironment.canAcceptItem(frame.context, this)) {

                    //  Do lazy reset if it's time
                    if (driver && driver.useLazyResets) {
                        if (typeof newEnvironment.reset === 'function') {
                            if (targetStore.nextReset < efuns.ticks) {
                                await targetStore.eventReset(frame.branch(172));
                            }
                        }
                    }

                    /* 
                     * MudOS-like init support:
                     */
                    if (targetStore.addInventory(this)) {
                        if (myStore.living) {
                            let stats = targetStore.stats;
                            if (stats) stats.moves++;
                            await newEnvironment.initAsync(frame.branch(184));
                        }
                        for (const item of newEnvironment.inventory) {
                            let itemStore = driver.storage.get(item.instance);
                            if (itemStore && itemStore !== myStore && itemStore.living) {
                                await frame.context.withPlayerAsync(itemStore, async () => await newEnvironment.initAsync(frame.branch(189)), true, 'initAsync');
                            }
                            if (myStore.living) {
                                await frame.context.withPlayerAsync(myStore, async () => await newEnvironment.initAsync(frame.branch(192)), true, 'initAsync');
                            }
                        }
                        return true;
                    }
                }
            }
            return false;
        }
        catch (err) {
            throw err;
        }
        finally {
            frame.pop();
        }
    }

    receiveMessage(ecc, msgClass, text) {
        const frame = ecc.push({ file: __filename, method: 'receiveMessage', lineNumber: __line, isAsync: false, className: this, callType: CallOrigin.LocalCall });
        try {
            let store = driver.storage.get(this);
            if (store.component) {
                if (msgClass.startsWith('N'))
                    store.component.write(text);
                else
                    store.component.writeLine(text);
            }
        }
        finally {
            frame.pop();
        }
    }

    serializeObject() {
        const frame = ecc.push({ file: __filename, method: 'serializeObject', lineNumber: __line, isAsync: false, className: this, callType: CallOrigin.CallOther });
        try {
            let $storage = driver.storage.get(this);
            return $storage.serialize();
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Generate a string representation of this object
     * @param {ExecutionContext} ecc The current callstack
     */
    toString(ecc) {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { object: this, method: 'toString' }, true, false);
        try {
            return `${this.constructor.name}[${this.filename}]`;
        }
        finally {
            frame?.pop();
        }
    }

    write(ecc, msg) {
        const frame = ecc.push({ file: __filename, method: 'write', lineNumber: __line, isAsync: false, className: this, callType: CallOrigin.LocalCall });
        try {
            let storage = driver.storage.get(this),
                shell = storage.shell,
                stdio = shell && shell.stdout;

            if (shell) {
                stdio.write(msg || '');
            }
            return this;
        }
        finally {
            frame.pop();
        }
    }

    writeLine(ecc, msg) {
        const frame = ecc.push({ file: __filename, method: 'writeLine', lineNumber: __line, isAsync: false, className: this, callType: CallOrigin.LocalCall });
        try {
            return this.write(msg + '\n');
        }
        finally {
            frame.pop();
        }
    }
}

//MUDObject.prototype.baseName = 'MUDObject';

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
        if (!typeOrInstance || typeOrInstance === null)
            return false;
        else if (typeOrInstance instanceof targetType)
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

    /**
     * Make a call to a virtual parent class
     * @param {typeof MUDObject} instance
     * @param {ExecutionContext} ecc
     * @param {any} methodName
     * @param {any} typeName
     * @param {any} args
     * @returns
     */
    static virtualCall(instance, ecc, methodName, typeName, args) {
        const vtable = MUDVTable.getVirtualTable(instance.constructor.prototype),
            methodMap = vtable.getMethod(methodName);
        let frame = ecc.push({ method: 'virtualCall', callType: 2 });
        try {
            if (!methodMap)
                throw new Error(`Type ${instance.constructor.name} does not have a method named '${methodName}'`)
            else if (typeName && !methodMap[typeName])
                throw new Error(`Type '${typeName}', inherited by ${instance.constructor.name}, does not have a method named '${methodName}'`)
            else if (typeName) {
                return methodMap[typeName].implementation.call(instance, frame.branch(), ...args);
            }
            else {
                let result = {};
                for (const [scopeName, method] of Object.entries(methodMap)) {
                    if (method.depth === 1)
                        result[scopeName] = method.implementation.call(instance, frame.branch(), ...args);
                }
                return result;
            }
        }
        finally {
            frame.pop();
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
