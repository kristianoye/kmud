﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDObject = require('./MUDObject'),
    MUDCompilerOptions = require('./compiler/MUDCompilerOptions'),
    { PipelineContext } = require('./compiler/PipelineContext'),
    events = require('events'),
    MemberModifiers = require("./compiler/MudscriptMemberModifiers");

var
    useAuthorStats = false,
    useDomainStats = false,
    useStats = false;

class MUDModuleTypeMemberInfo {
    /**
     * 
     * @param {MUDModuleTypeInfo} definingType
     * @param {string} memberName
     * @param {number} modifiers
     */
    constructor(definingType, memberName, modifiers) {
        this.definingType = definingType;
        this.memberName = memberName;
        this.modifiers = modifiers;
    }

    get filename() {
        return this.definingType.filename;
    }

    get typeName() {
        return this.definingType.typeName;
    }

    typeIs(flags) {
        return (this.modifiers & flags) === flags;
    }
}

class MUDModuleImportedMemberInfo {
    constructor(memberName, modifiers) {
        /** @type {MUDModuleTypeInfo[]} */
        this.implementors = [];
        this.memberName = memberName;
        this.modifiers = modifiers;
    }

    /**
     * 
     * @param {MUDModuleTypeMemberInfo | MUDModuleImportedMemberInfo} impl
     */
    addImplementation(impl) {
        if (impl instanceof MUDModuleImportedMemberInfo) {
            this.modifiers |= impl.modifiers;
            this.implementors.push(...impl.implementors);
        }
        else {
            this.modifiers |= impl.modifiers;
            this.implementors.push(impl);
        }
    }

    getFinalDefiners() {
        return this.implementors.filter(info => (info.modifiers & MemberModifiers.Final) > 0);
    }

    get length() {
        return this.implementors.length;
    }

    typeIs(flags) {
        return (this.modifiers & flags) === flags;
    }
}

class MUDModuleTypeInfo {
    /**
     * @param {MUDModule} definedIn The module in which the type is defined
     * @param {string} typeName The name of the type being defined
     * @param {number} modifiers Modifiers declared by the class (final, abstract, etc.)
     * @param {{ line: number, char: number }} position The position of the class declaration start
     */
    constructor(definedIn, typeName, modifiers, position) {
        this.module = definedIn;
        /** @type {string} */
        this.filename = definedIn.filename;
        this.position = position;
        /** @type {string} */
        this.typeName = typeName;
        /** @type {Object.<string,MUDModuleImportedMemberInfo>} */
        this.inheritedMembers = {};
        /** @type {Object.<string,MUDModuleTypeMemberInfo>} */
        this.members = {};
        /** @type {number} */
        this.modifiers = modifiers;
        this.unimplementedAbstractMembers = {};
    }

    addMember(memberName, modifiers = 0) {
        let member = this.members[memberName] = new MUDModuleTypeMemberInfo(this, memberName, modifiers);

        if (member in this.unimplementedAbstractMembers) {
            delete this.unimplementedAbstractMembers[member];
        }
        return member;
    }

    getMember(memberName) {
        return this.members[memberName] || false;
    }

    getInheritedMember(memberName) {
        return this.inheritedMembers[memberName] || false;
    }

    importTypeInfo(typeRef) {
        let info = driver.efuns.parsePath(typeRef.prototype.baseName),
            file = info.file,
            /** @type {MUDModule} */ module = driver.cache.get(file),
            typeDef = module && module.getTypeDefinition(typeRef.name);

        if (typeDef) {
            for (const [memberName, info] of Object.entries(typeDef.inheritedMembers)) {
                if (memberName in this.inheritedMembers) {
                    this.inheritedMembers[memberName].addImplementation(info);
                }
                else {
                    this.inheritedMembers[memberName] = info;
                }

                if (info.typeIs(MemberModifiers.Abstract)) {
                    this.unimplementedAbstractMembers[memberName] = info;
                }
            }
            for (const [memberName, info] of Object.entries(typeDef.members)) {
                let existingMember = this.inheritedMembers[memberName] || false;

                if (info.typeIs(MemberModifiers.Abstract)) {
                    this.unimplementedAbstractMembers[memberName] = info;
                }
                else if (memberName in this.unimplementedAbstractMembers) {
                    delete this.unimplementedAbstractMembers[memberName];
                }

                if (existingMember) {
                    let existingMember = this.inheritedMembers[memberName];

                    //  This member implemented a previously abstract method
                    if (existingMember.typeIs(MemberModifiers.Abstract) && !info.typeIs(MemberModifiers.Abstract)) {
                        existingMember.modifiers &= ~MemberModifiers.Abstract;
                    }
                    existingMember.addImplementation(info);
                }
                else {
                    existingMember = this.inheritedMembers[memberName] = new MUDModuleImportedMemberInfo(memberName, 0);
                    existingMember.addImplementation(info);
                }
            }
        }
    }

    get isAbstract() {
        return (this.modifiers & MemberModifiers.Abstract) > 0;
    }

    get isFinal() {
        return (this.modifiers & MemberModifiers.Final) > 0;
    }

    isMember(memberName) {
        return memberName in this.members === true;
    }

    get isSingleton() {
        return (this.modifiers & MemberModifiers.Singleton) > 0;
    }
}

/**
 * Contains information about a previously loaded MUD module.
 */
class MUDModule extends events.EventEmitter {
    /**
     * @param {PipelineContext} context
     * @param {boolean} isVirtual Is this a virtual request?
     * @param {MUDCompilerOptions} options Options passed in from the compiler
     * @param {MUDModule} [parent] If this is a virtual object it needs a parent
     */
    constructor(context, isVirtual, options, parent = false) {
        super();

        let isMixin = options.isMixin === true;

        /**
         * Options passed in from the compiler
         * @type {MUDCompilerOptions} */
        this.compilerOptions = options;

        this.$defaultExport = false;

        /**
         * A list of modules this module depends on
         * @type {MUDModule[]} 
         */
        this.dependencies = [];

        /**
         * A list of modules that DEPEND on this module
         * @type {MUDModule[]} 
         */
        this.dependents = [];

        /** Has the default been explicitly set? */
        this.explicitDefault = false;

        /** @type {Object.<string, MUDModuleTypeInfo>} */
        this.typeDefinitions = {};

        /** @type {string[]} */
        this.typeNames = [];

        /** @type {Object.<string,function>} */
        this.types = { length: 0 };

        this.oldExports = { length: 0 };

        /** @type {Object.<string,MUDObject[]> */
        this.instanceMap = {};

        /** @type {MUDObject[]} */
        this.instances = [];

        /**
         * Maps instance UUID to the actual object 
         * @type {Object.<string,MUDObject>} 
         */
        this.instancesById = {};

        this.isMixin = isMixin === true;

        this.directory = context.directory;

        this.filename = context.filename;

        /**
         * The file part of the MUD path
         * @type {string}
         */
        this.name = context.filename.slice(context.filename.lastIndexOf('/') + 1);

        /**
         * The full path to the source module (including extension)
         * @type {string}
         */
        this.fullPath = context.fullPath;

        this.isVirtual = isVirtual;

        /** @type {boolean} */
        this.loaded = false;

        /** @type {MUDModule} */
        this.parent = null;

        this.singleton = false;

        /** @type {Object.<string,boolean> */
        this.singletons = {};

        if (parent) {
            parent.on && parent.on('recompile', () => {
                /* the module should rebuild all instances */
            });
        }
    }

    /**
     * Configure the module system for runtime
     * @param {any} driver
     */
    static configureForRuntime(driver) {
        useAuthorStats = driver.config.driver.featureFlags.authorStats === true;
        useDomainStats = driver.config.driver.featureFlags.domainStats === true;
        useStats = useAuthorStats | useDomainStats;
        if (useStats)
            DomainStats = require('./features/DomainStats');
    }

    get defaultExport() {
        return this.$defaultExport;
    }

    set defaultExport(val) {
        if (driver.efuns.isClass(val)) {
            let flags = val.prototype.typeModifiers || 0;

            if ((flags & MemberModifiers.Singleton) > 0)
                this.$defaultExport = new val();
            else 
                this.$defaultExport = val;
        }
        else
            this.$defaultExport = val;
    }

    async setDefaultExport(val) {
        if (driver.efuns.isClass(val)) {
            let flags = val.prototype.typeModifiers;

            if ((flags & MemberModifiers.Singleton) > 0) {
                let inst = await this.createInstanceAsync(val, false, [], false, this.filename);
                this.$defaultExport = inst;
            }
            else
                this.$defaultExport = val;
        }
        else
            this.$defaultExport = val;
    }

    insertInstance(item, typeArg) {
        let instanceId = item.instanceId,
            typeName = typeArg ? typeArg.name : item.constructor.name,
            instances = this.instanceMap[typeName] || [];
        instances[instanceId] = item;
        this.instanceMap[typeName] = instances;
    }

    addExportElement(val, key = false, isDefault = false) {
        if (!key) {
            if (efuns.isClass(val)) key = val.name;
            else if (val instanceof MUDObject) key = val.constructor.name;
            else if (typeof val === 'function') key = val.name;
        }

        this.oldExports.length++;
        this.singletons[key] = val instanceof MUDObject;

        if (isDefault === false && this.explicitDefault === false) {
            if (this.oldExports.length === 1)
                this.defaultExport = val;
            else if (key === this.name)
                this.defaultExport = val;
            else
                this.defaultExport = false;
        }
        else if (isDefault === true) {
            this.defaultExport = val;
            this.explicitDefault = true;
        }

        this.oldExports[key] = val;
    }

    /**
     * Add an item to the module export list
     * @param {any} val The item to export
     * @param {boolean} [isDefault] If true, then the item is marked as the default export
     */
    addExport(val, isDefault = false) {
        if (Array.isArray(val)) {
            val.forEach(a => this.addExportElement(a, undefined, isDefault));
        }
        else if (val instanceof MUDObject) {
            this.addExportElement(val, val.constructor.name, isDefault);
        }
        else if (typeof val === 'object') {
            Object.keys(val)
                .forEach(key => this.addExportElement(val[key], key));

            if (isDefault === true) {
                this.defaultExport = Object.assign({}, val);
                this.explicitDefault = true;
            }
        }
        else if (efuns.isClass(val)) {
            this.addExportElement(val, val.name, isDefault);
        }
        else if (typeof val === 'function') {
            this.addExportElement(val, val.name, isDefault);
        }
    }

    /**
     * Add a virtual type
     * @param {MUDModule} parent The parent module
     * @param {function} type The type to add
     */
    addVirtualType(parent, type) {
        this.isVirtual = true;
        this.parent = parent;
        this.types[type.name] = type;
        this.types.length++;
        this.instanceMap[type.name] = {};
        return true;
    }

    create(type, instanceData, args = [], create = false) {
        try {
            // Storage needs to be set before starting...
            let store = driver.storage.createForId(instanceData.filename || instanceData.$type),
                ecc = driver.getExecution(),
                prev = ecc.previousObject;

            if (typeof type === 'string') {
                if (type in this.oldExports === false) {
                    if (type in this.types === false) {
                        throw new Error(`Unable to find type ${type}`);
                    }
                    else if (prev.filename !== this.filename) {
                        throw new Error(`Access denied to non-exported type ${type} in module ${this.filename}`);
                    }
                }
                if (typeof instanceData.instanceId !== 'number') {
                    let instances = this.instanceMap[type];
                    instanceData.instanceId = instances.length;
                    instanceData.uuid = driver.efuns.getNewId();
                }
                type = this.types[type];
            }

            ecc.addCreationContext(instanceData);
            ecc.storage = store;

            let instance = create ? create(type, ...args) : new type(...args);
            this.finalizeInstance(instance, !instance.filename && instanceData);
            if (typeof instance.create === 'function') {
                driver.driverCall('create', () => {
                    instance.create();
                }, instance.filename, true);
            }
            store.owner = instance;
            return instance;
        }
        catch (err) {
            /* rollback object creation */
            driver.storage.delete(instanceData.filename);
            throw err;
        }
    }

    /**
     * Create an object asynchronously
     * @param {string} type The specific type to create
     * @param {CreationContext} instanceData Information for the newly defined object
     * @param {any[]} args Arguments to pass to the object constructor and/or create method
     * @param {function(type,...any):MUDObject}factory A custom factory method
     */
    async createAsync(type, instanceData, args = [], factory = false) {
        try {
            if (typeof type === 'string') {
                if (type in this.oldExports === false) {
                    if (type in this.types === false) {
                        throw new Error(`Unable to find type ${type}`);
                    }
                    else if (prev.filename !== this.filename) {
                        throw new Error(`Access denied to non-exported type ${type} in module ${this.filename}`);
                    }
                }
                type = this.types[type];
            }
            if (typeof instanceData.instanceId !== "number") {
                let instances = this.instanceMap[type.constructor.name];
                instanceData.instanceId = instances.length;
            }
            // Storage needs to be set before starting...
            let store = driver.storage.createForId(instanceData.filename, instanceData.instanceId),
                ecc = driver.getExecution();

            ecc.addCreationContext(instanceData);
            ecc.storage = store;

            let instance = factory ? factory(type, ...args) : new type(...args);
            this.finalizeInstance(instance, !instance.filename && instanceData);
            if (typeof instance.create === 'function') {
                await driver.driverCallAsync('create', async () => await instance.create());
            }
            await driver.driverCallAsync('initStorage', async () => await store.eventInitialize(instance));

            return instance;
        }
        catch (err) {
            /* rollback object creation */
            driver.storage.delete(instanceData.filename);
            throw err;
        }
    }

    async createInstanceAsync(type, instanceData, args, factory = false, callingFile = false) {
        try {
            let instance = false, store = false;

            if (typeof type === 'string' && !this.isVirtual) {
                if (type in this.oldExports === false) {
                    //  Always allow module to create its own types
                    if (callingFile === this.filename) {
                        type = this.types[type];
                    }
                    else if (type in this.types === false) {
                        if (this.oldExports.length === 1 && this.$defaultExport)
                            type = this.$defaultExport;
                        else
                            throw new Error(`Unable to find type ${type}`);
                    }
                    else
                        type = this.types[type];
                }
                else
                    type = this.types[type];
            }
            //  Total hack for now
            else if (this.isVirtual && this.oldExports.length === 0 && this.defaultExport instanceof MUDObject) {
                instance = this.defaultExport;
                store = driver.storage.get(instance);
            }
            if (instance === false) {
                let ecc = driver.getExecution();
                let virtualContext = ecc && ecc.popVirtualCreationContext();

                if (virtualContext) {
                    virtualContext.module.addVirtualType(this, type);
                    return await virtualContext.module.createInstanceAsync(type, virtualContext, args);
                }
                if (!instanceData)
                    instanceData = this.getNewContext(type, false, args);

                if (typeof instanceData.instanceId !== "number") {
                    let instances = this.instanceMap[type.constructor.name];
                    instanceData.instanceId = instances.length;
                    instanceData.uuid = driver.efuns.getNewId();
                }
                // Storage needs to be set before starting...
                store = driver.storage.createForId(instanceData.filename, instanceData.instanceId);

                ecc.addCreationContext(instanceData);
                ecc.storage = store;

                instance = factory ? factory(type, ...args) : new type(...args);
                this.finalizeInstance(instance, !instance.filename && instanceData);

                if (typeof this.compilerOptions.onInstanceCreated === 'function') {
                    this.compilerOptions.onInstanceCreated(instance);
                }

                if (typeof instance.create === 'function') {
                    await ecc.withObject(instance, 'create', async () => {
                        return await instance.create(...args);
                    }, true, true);
                }
            }
            if (store !== false && instance !== false)
                await driver.driverCallAsync('initStorage', async () => await store.eventInitialize(instance));

            return instance;
        }
        catch (err) {
            /* rollback object creation */
            driver.storage.delete(instanceData.filename);
            throw err;
        }
    }

    /**
     * Destroy an instance of an object and invalidate all wrappers.
     * @param {PathExpr} parts The instance information
     */
    destroyInstance(parts) {
        let instances = this.instanceMap[parts.type],
            instance = instances[parts.instance];

        if (instance) {
            let store = driver.storage.get(instance);
            instances[parts.instance] = false;

            if (instance.objectId)
                delete this.instancesById[instance.objectId];
            if (store && !store.destroyed)
                return store.destroy();
            return true;
        }
        return false;
    }

    get exports() {
        return typeof this.oldExports === 'object' ? Object.assign({}, this.oldExports) : {};
    }

    set exports(spec) {
        if (spec === false)
            this.oldExports = {};
        else if (typeof spec === 'object') {
            for (const [key, val] of Object.entries(spec)) {
                this.oldExports[key] = val;
            }
        }
        else
            throw new Error(`Unexpected export value of type ${typeof spec}`);
    }

    finalizeInstance(instance, instanceData) {
        let type = instance.constructor.name;

        if (typeof this.types[type] === 'undefined')
            throw new Error(`Module ${this.this.filename} does define type ${type}!`);

        if (instanceData) {
            Object.defineProperties(instance, {
                createTime: {
                    value: efuns.ticks,
                    writable: false
                },
                filename: {
                    value: instanceData.filename || instanceData.$type,
                    writable: false
                },
                instanceId: {
                    value: instanceData.instanceId,
                    writable: false,
                    enumerable: true
                },
                isVirtual: {
                    value: instanceData.isVirtual === true,
                    writable: false,
                    enumerable: false
                }
            });
        }
        this.instanceMap[type][instance.instanceId] = instance;
        this.instancesById[instance.objectId] = instance;
    }

    /**
     * Request a specific instance of a type.
     * @param {PathExpr} req The instance request.
     * @returns {MUDObject} The specified instance.
     */
    getInstance(req) {
        if (typeof req === 'number') {
            req = {
                type: this.name,
                instance: req,
                file: this.fullPath
            };
        }
        let typeSpec = req.type.slice(0);
        if (req.defaultType === true && !this.types[typeSpec]) {
            if (this.$defaultExport) {
                if (driver.efuns.isClass(this.$defaultExport))
                    typeSpec = this.$defaultExport.name;
                else if (typeof this.$defaultExport === 'object')
                    typeSpec = this.$defaultExport.constructor.name;
            }
        }
        if (!this.types[typeSpec]) {
            if (req.instance === 0) {
                if (this.defaultExport instanceof MUDObject)
                    return this.defaultExport;
            }
            return req.instance === 0 && this.instanceMap[req.instance];
        }
        let instances = this.instanceMap[typeSpec] || [];
        if (req.instance < 0 || req.instance > instances.length) {
            if (req.objectId) {
                if (true === req.objectId in this.instancesById) {
                    return this.instancesById[req.objectId];
                }
            }
            return false;
        }
        return instances[req.instance];
    }

    /**
     * Get all instances for the specified types
     * @param {...string} typeList
     */
    getInstances(...typeList) { 
        let result = [];

        if (!Array.isArray(typeList) || typeList.length === 0)
            typeList = Object.keys(this.instanceMap);

        (typeList || Object.keys(this.instanceMap)).forEach(type => {
            let instances = this.instanceMap[type].filter(o => typeof o === 'object');
            result.push(...instances);
        });
        return result;
    }

    /**
     * Creates a weak reference to a particular MUDObject instance.
     * @param {PathExpr} req The instance request.
     * @returns {MUDWrapper} The specified instance.
     */
    getInstanceWrapper(req) {
        let instance = this.getInstance(req);

        if (instance) {
            let wrapper = (() => {
                let initialized = false;

                return () => {
                    let instance = this.getInstance(req);
                    if (instance) {
                        if (instance === -1 || instance.destructed) {
                            instance = -1;
                            throw new Error(`Object ${req.file} has been destructed [Invalid Wrapper]`);
                        }
                        return instance;
                    }

                    if (!initialized) {
                        this.once('recompiled', () => {
                            let typeName = instance.constructor.name;
                            instance = this.instanceMap[typeName][req.instance] =
                                this.create(this.getType(typeName), {
                                    filename: req.file,
                                    instanceId: req.instance,
                                    isVirtual: instance && instance.isVirtual
                                });
                        });
                        initialized = true;
                    }
                    return instance;
                };
            })();

            Object.defineProperties(wrapper, {
                filename: {
                    value: instance.filename,
                    writable: false
                },
                objectId: {
                    value: instance.objectId,
                    writable: false
                },
                isWrapper: {
                    value: true,
                    writable: false,
                    enumerable: false
                }
            });
            Object.freeze(wrapper);
            return wrapper;
        }
        return false;
    }

    /**
     * Create information required to create a new MUDObject instance.
     * @param {string|function} type The type to fetch a constructor context for.
     * @param {number} idArg Specify the instance ID.
     * @returns {{ filename: string, instanceId: number }} Information needed by MUDObject constructor.
     */
    getNewContext(type, idArg, args) {
        let typeName = typeof type === 'function' ? type.name
            : typeof type === 'string' ? type : false;


        let instanceId = typeof idArg === 'number' ? idArg : (this.instanceMap[typeName] || []).length,
            filename = this.filename + (this.name !== typeName ? '$' + typeName : '');

        if (instanceId > 0) {
            if (this.singletons[typeName]) {
                if (!this.isCompiling)
                    throw new Error(`Type ${this.filename}$${typeName} is a singleton and cannot be cloned`);
                else
                    instanceId = 0;
            }
            else
                filename += '#' + instanceId;
        }
        
        let result = {
            args: args || [],
            uuid: driver.efuns.getNewId(),
            constructor: this.types[type] || type,
            filename,
            instanceId,
            module: this
        };

        return result;
    }

    /**
     * Get a type defined within the module. [questionable]
     * @param {string} name The name of the type to retrieve.
     * @returns {function} Returns the constructor for the specified type.
     */
    getType(name) {
        return name && this.types[name] || this.types[this.name] || false;
    }

    /**
     * Returns all types defined in the module
     */
    getTypes() {
        return Object.keys(this.types);
    }

    /**
     * Adds a module this module depends on
     * @param {any} mod
     */
    eventAddDependency(mod) {
        if (this.dependencies.indexOf(mod) === -1)
            this.dependencies.push(mod);
    }

    /**
     * Add a dependent module
     * @param {MUDModule} mod
     */
    eventAddDependent(mod) {
        if (this.dependents.indexOf(mod) === -1)
            this.dependents.push(mod);
        return this;
    }

    eventBeginTypeDefinition(typeName, modifiers, pos) {
        let typeDef = this.currentTypeDef = new MUDModuleTypeInfo(this, typeName, modifiers, pos);

        this.typeDefinitions[typeName] = typeDef;

        return typeDef;
    }

    getTypeDefinition(typeName) {
        return this.typeDefinitions[typeName] || false;
    }

    /**
     * Event is called after the module is re-compiled
     * @param {boolean} isReload
     * @param {MUDCompilerOptions} options
     */
    eventCreateInstances(isReload, options) {
        if (isReload === true) {

        }
    }

    /**
     * Define a new type within the module
     * @param {any} type
     */
    eventDefineType(type) {
        this.types[type.name] = type;
        this.typeNames.push(type.name);

        if (type.name in this.instanceMap == false)
            this.instanceMap[type.name] = [];

        let parentType = Object.getPrototypeOf(type);
        if (parentType && typeof parentType.prototype.baseName === 'string' && parentType.prototype.baseName !== 'MUDObject') {
            let { file } = driver.efuns.parsePath(parentType.prototype.baseName),
                parentModule = driver.cache.get(file);

            parentModule.eventAddDependent(this);
            this.eventAddDependency(parentModule);
        }
    }

    /**
     * Fires when a module is updated in-game.  This process makes sure that
     * all in-game instances are also updated and that child modules and
     * child instances are updated as well.
     * 
     * @param {MUDCompilerOptions} options
     */
    async eventRecompiled(options) {
        if (options.reloadDependents) {
            for (const mod of this.dependents) {
                try {
                    let childOptions = options.createChildOptions(mod.fullPath),
                        fso = await driver.efuns.fs.getFileAsync(mod.fullPath);

                    await fso.compileAsync(childOptions);

                    options.onDebugOutput(`Updating dependent module: ${mod.filename}: [Ok]`, 3);
                }
                catch (err) {
                    options.onDebugOutput(`Updating dependent module: ${mod.filename}: Error: ${err}`, 3);
                }
            }
        }
    }

    eventRemoveDependent(mod) {
        let n = this.dependents.indexOf(mod);

        if (n > -1) {
            this.dependents.splice(n, 1);
        }
    }

    eventResetModule() {
        this.oldExports = { length: 0 };
        this.singletons = {};
        this.typeNames = [];
        this.types = { length: 0 };
        this.defaultExport = false;
        this.explicitDefault = false;

        for (const dep of this.dependencies) {
            /** @type {MUDModule} */
            let parentModule = driver.cache.get(dep.fullPath);
            if (parentModule) {
                parentModule.eventRemoveDependent(this);
            }
        }
        this.dependencies = [];
    }

    /**
     * Seal all defined types to prevent tampering
     */
    sealTypes() {
        this.types && Object.keys(this.types)
            .forEach(tn => Object.freeze(this.types[tn]));
        return this;
    }
}

module.exports = MUDModule;
