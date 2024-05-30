const SimpleObject = require('./SimpleObject');

/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDObject = require('./MUDObject'),
    MUDCompilerOptions = require('./compiler/MUDCompilerOptions'),
    { PipelineContext } = require('./compiler/PipelineContext'),
    events = require('events'),
    MemberModifiers = require("./compiler/MudscriptMemberModifiers"),
    MemberType = {
        Unknown: 0,
        Property: 1 << 0,
        PropertyGetter: 1 << 1,
        PropertySetter: 1 << 2,
        Method: 1 << 3
    };

var
    useAuthorStats = false,
    useDomainStats = false,
    useStats = false;

/** @typedef {{ char: number, file:string, line: number }} MUDFilePosition */

class MUDModuleTypeMemberInfo {
    /**
     * 
     * @param {MUDModuleTypeInfo} definingType
     * @param {string} memberName
     * @param {number} modifiers
     */
    constructor(definingType, memberName, modifiers, depth = 0) {
        /** @type {MUDModuleTypeInfo} */
        this.definingType = definingType;
        /** @type {string} */
        this.memberName = memberName;
        /** @type {number} */
        this.modifiers = modifiers;
        /** @type {number} */
        this.depth = depth;
        /** @type {number} */
        this.memberType = MemberType.Unknown;

        if (memberName.indexOf('get ')) {
            this.memberType = MemberType.Property | MemberType.PropertyGetter;
        }
        else if (memberName.indexOf('set ')) {
            this.memberType = MemberType.Property | MemberType.PropertySetter;
        }
        else {
            this.memberType = MemberType.Method;
        }
    }

    get filename() {
        return this.definingType.filename;
    }

    get isAbstract() {
        return (this.modifiers & MemberModifiers.Abstract) > 0;
    }

    get isAsync() {
        return (this.modifiers & MemberModifiers.Async) > 0;
    }

    get isFinal() {
        return (this.modifiers & MemberModifiers.Final) > 0;
    }

    get isGetter() {
        return (this.memberType & MemberType.PropertyGetter) > 0;
    }

    get isOrigin() {
        return (this.modifiers & MemberModifiers.Origin) > 0;
    }

    get isPackage() {
        return (this.modifiers & MemberModifiers.Package) > 0;
    }

    get isProperty() {
        return (this.memberType & MemberType.Property) > 0;
    }

    get isProtected() {
        return (this.modifiers & MemberModifiers.Protected) > 0;
    }

    get isPublic() {
        return (this.modifiers & MemberModifiers.Public) > 0;
    }

    get isSetter() {
        return (this.memberType & MemberType.PropertySetter) > 0;
    }

    get typeName() {
        return this.definingType.typeName;
    }

    typeIs(flags) {
        return (this.modifiers & flags) === flags;
    }
}

class MUDModuleImportedMemberInfo {
    /**
     * 
     * @param {string | MUDModuleImportedMemberInfo} memberName
     * @param {number} modifiersOrTargetDepth
     */
    constructor(memberName, modifiersOrTargetDepth = -1) {
        /** @type {MUDModuleTypeMemberInfo[]} */
        this.implementors = [];
        if (memberName instanceof MUDModuleImportedMemberInfo) {
            if (modifiersOrTargetDepth > -1)
                this.implementors = memberName.implementors.filter(impl => impl.depth === modifiersOrTargetDepth);
            else
                this.implementors = memberName.implementors.map(impl => new MUDModuleTypeMemberInfo(impl.definingType, impl.memberName, impl.modifiers, impl.depth + 1));
            this.memberName = memberName.memberName;
            this.modifiers = memberName.modifiers;
        }
        else {
            this.memberName = memberName;
            this.modifiers = modifiersOrTargetDepth;
        }
    }

    /**
     * 
     * @param {MUDModuleTypeMemberInfo | MUDModuleImportedMemberInfo} impl
     * @param {number} depth How far back in the inheritance chain was this item imported?
     */
    addImplementation(impl, depth) {
        if (impl instanceof MUDModuleImportedMemberInfo) {
            let previousImplementors = impl.implementors.map(impl => new MUDModuleTypeMemberInfo(impl.definingType, impl.memberName, impl.modifiers, impl.depth + 1));
            this.modifiers |= impl.modifiers;
            this.implementors.push(...previousImplementors);
        }
        else {
            this.modifiers |= impl.modifiers;
            this.implementors.push(new MUDModuleTypeMemberInfo(impl.definingType, impl.memberName, impl.modifiers, depth));
        }
    }

    getFinalDefiners() {
        return this.implementors.filter(info => (info.modifiers & MemberModifiers.Final) > 0);
    }

    get length() {
        return this.implementors.length;
    }

    get minDepth() {
        return Math.min(...this.implementors.map(impl => impl.depth));
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
     * @param {MUDFilePosition} position The position of the class declaration start
     */
    constructor(definedIn, typeName, modifiers, position) {
        this.module = definedIn;

        /**
         * Does this type have an async constructor in its chain?
         * @type {boolean}
         */
        this.hasAsyncConstructor = false;

        /** @type {string} */
        this.filename = definedIn.filename;

        /** @type {MUDFilePosition} */
        this.position = position;

        /** @type {string} */
        this.typeName = typeName;

        /** @type {Object.<string,MUDModuleImportedMemberInfo>} */
        this.inheritedMembers = {};

        /** 
         * Contains the direct descendants of this type
         * @type {Object.<string,MUDModuleTypeInfo>} 
         */
        this.inheritedTypes = {};

        /** 
         * Contains the direct descendants of this type using alias
         * @type {Object.<string,MUDModuleTypeInfo>} 
         */
        this.inheritedTypeAliases = {};

        /** @type {Object.<string,MUDModuleTypeMemberInfo>} */
        this.members = {};

        /** 
         * @type {number} 
         */
        this.modifiers = modifiers;

        /**
         * Members that must be implemented in a non-abstract class
         * @type {Object.<string,MUDModuleTypeMemberInfo[]>}
         */
        this.abstractMembers = {};

        /**
         * Members that must be scoped
         * @type {Object.<string,MUDModuleTypeMemberInfo[]>}
         */
        this.ambiguousMembers = {};

        /**
         * Members that cannot be redifined
         * @type {Object.<string,MUDModuleTypeMemberInfo[]>}
         */
        this.finalMembers = {};

        this.importedMembers = {};

        /**
         * Members that define a specific property storage location
         * @type {Object.<string,MUDModuleTypeMemberInfo[]>}
         */
        this.propertyOrigins = {};

        this.possibleLazyBindings = {};
        this.lazyBindingCount = 0;
    }

    /**
     * Add a member defined within this type
     * @param {string} memberName
     * @param {number} modifiers
     * @returns {MUDModuleTypeMemberInfo | string} Returns the newly defined member object or an error message
     */
    addMember(memberName, modifiers = 0) {
        let member = this.members[memberName] = new MUDModuleTypeMemberInfo(this, memberName, modifiers);

        if (memberName in this.finalMembers) {

        }

        if (memberName in this.possibleLazyBindings) {
            //  Nope, this member is actually defined
            delete this.possibleLazyBindings[memberName];
        }

        //  Does this type implement an abstract member?
        if (memberName in this.abstractMembers && !member.isAbstract) {
            delete this.abstractMembers[memberName];
            this.lazyBindingCount--;
        }
        else if (member.isAbstract) {
            if (!this.isAbstract)
                return `Member '${memberName}' cannot be abstract unless defining type ${this.typeName} is also declared abstract`;
            this.getOrCreateMemberEntry(this.abstractMembers, member);
        }
        if (member.isFinal) {
            this.getOrCreateMemberEntry(this.finalMembers, member);
        }
        if (member.isOrigin) {
            this.getOrCreateMemberEntry(this.propertyOrigins, member);
        }
        if (memberName === MemberModifiers.ConstructorName && member.isAsync) {
            this.hasAsyncConstructor |= true;
        }
        return member;
    }

    addPossibleLazyBinding(prop) {
        if (prop in this.members === false && /^[a-zA-Z0-9\$]+$/.test(prop)) {
            this.possibleLazyBindings[prop] = true;
            this.lazyBindingCount++;
        }
    }

    getMember(memberName) {
        return this.members[memberName] || false;
    }

    getInheritedMember(memberName) {
        let memberInfo = this.inheritedMembers.hasOwnProperty(memberName) && this.inheritedMembers[memberName],
            minDepth = memberInfo && memberInfo.minDepth;

        if (!memberInfo)
            return false;

        return new MUDModuleImportedMemberInfo(memberInfo, minDepth);
    }

    /**
     * 
     * @param {Object.<string,MUDModuleTypeMemberInfo[]>} collection The collection to add to
     * @param {MUDModuleTypeMemberInfo} member The member to add
     * @returns {MUDModuleTypeMemberInfo[]}
     */
    getOrCreateMemberEntry(collection, member) {
        if (member.memberName in collection === false) {
            collection[member.memberName] = [];
        }
        if (collection[member.memberName].indexOf(member) === -1)
            collection[member.memberName].push(member);
        return collection[member.memberName];
    }

    importTypeInfo(typeRef, typeAlias) {
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
                    this.inheritedMembers[memberName] = new MUDModuleImportedMemberInfo(info);
                }

                if (info.typeIs(MemberModifiers.Abstract)) {
                    this.abstractMembers[memberName] = info;
                }
            }
            for (const [memberName, info] of Object.entries(typeDef.members)) {
                let existingMember = this.inheritedMembers[memberName] || false;

                if (info.isAbstract) {
                    this.abstractMembers[memberName] = info;
                }
                else if (memberName in this.abstractMembers) {
                    delete this.abstractMembers[memberName];
                }

                if (existingMember) {
                    let existingMember = this.inheritedMembers[memberName];

                    //  This member implemented a previously abstract method
                    if (existingMember.typeIs(MemberModifiers.Abstract) && !info.isAbstract) {
                        existingMember.modifiers &= ~MemberModifiers.Abstract;
                    }
                }
                else {
                    existingMember = this.inheritedMembers[memberName] = new MUDModuleImportedMemberInfo(memberName, info.modifiers);
                }
                existingMember.addImplementation(info, info.depth + 1);
            }

            this.inheritedTypes[typeDef.typeName] = typeDef;
            if (typeAlias !== typeDef.typeName)
                this.inheritedTypeAliases[typeAlias] = typeDef;
            this.hasAsyncConstructor |= typeDef.hasAsyncConstructor;
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

        /**
         * Options passed in from the compiler
         * @type {MUDCompilerOptions} */
        this.compilerOptions = options;

        /**
         * Information needed to re-create object instances on recompile
         * @type {Object.<string,CreationContext>}
         */
        this.creationContexts = {};

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
        this.types = {};

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

        /**
         * @type {Object.<string,string[]}
         */
        this.instancesByType = {};

        /**
         * The directory the module source file is located in
         * @type {string}
         */
        this.directory = context.directory;

        /**
         * The file the module source is located in
         * @type {string}
         */
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

        /**
         * Is this module a virtual module (no source code)?
         * @type {boolean}
         */
        this.isVirtual = isVirtual;

        /** @type {boolean} */
        this.loaded = false;

        /** @type {MUDModule} */
        this.parent = null;

        this.singleton = false;

        /** @type {Object.<string,boolean> */
        this.singletons = {};

        /**
         * @type {Object.<string,MUDObject>}
         */
        this.virtualInstances = {};

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

    addExportElement(val, key = false, isDefault = false) {
        if (!key) {
            if (efuns.isClass(val)) key = val.name;
            else if (val instanceof MUDObject) key = val.constructor.name;
            else if (val instanceof SimpleObject) key = val.constructor.name;
            else if (typeof val === 'function') key = val.name;
        }

        this.oldExports.length++;
        this.singletons[key] = val instanceof MUDObject || val instanceof SimpleObject;

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
        else if (val instanceof MUDObject || val instanceof SimpleObject) {
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

    addInstance(instance, type, creationContext) {
        let objectId = instance.objectId;

        this.instancesById[objectId] = instance;

        if (false === type.name in this.instancesByType)
            this.instancesByType[type.name] = [];
        if (this.instancesByType[type.name].indexOf(objectId) === -1)
            this.instancesByType[type.name].push(objectId);
        this.creationContexts[objectId] = creationContext;

        if (instance.isVirtual) {
            let parts = driver.efuns.parsePath(instance.filename);
            this.virtualInstances[parts.file] = objectId;
        }

        return instance;
    }

    async createInstanceAsync(type, instanceData, args, factory = false, callingFile = false, isReload = false) {
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
            if (instance === false) {
                let ecc = driver.getExecution();
                let virtualContext = ecc && ecc.popVirtualCreationContext();

                if (virtualContext) {
                    virtualContext.module = this;
                    virtualContext.trueName = this.filename + '$' + type.name + '#' + virtualContext.objectId;
                    virtualContext.typeName = type.name;
                    return await this.createInstanceAsync(type, virtualContext, args);
                }

                if (!instanceData) {
                    instanceData = this.getNewContext(type, false, args);
                }

                if (!instanceData.wrapper)
                    instanceData.wrapper = this.getWrapperForContext(instanceData);

                // Storage needs to be set before starting...
                store = driver.storage.createForId(instanceData.objectId, instanceData.filename);

                ecc.addCreationContext(instanceData);
                ecc.storage = store;

                instance = factory ? factory(type, ...args) : new type(...args);
                this.addInstance(instance, type, instanceData);

                if (typeof this.compilerOptions.onInstanceCreated === 'function') {
                    this.compilerOptions.onInstanceCreated(instance);
                }

                if (typeof instance.create === 'function') {
                    await ecc.withObject(instance, 'create', async () => {
                        let result = await instance.create(...args);
                        if (typeof instance.postCreate === 'function') {
                            try {
                                await instance.postCreate();
                            }
                            catch (err) {

                            }
                        }
                        return result;
                    }, true, true);
                }
                if (store !== false && instance !== false)
                    await driver.driverCallAsync('initStorage', async () => await store.eventInitialize(instance));
            }

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
     * @param {MUDObject} ob The instance information
     */
    destroyInstance(ob) {
        let objectId = ob.objectId,
            typeName = ob.constructor.name,
            instanceList = this.instancesByType[typeName] || false,
            index = instanceList && instanceList.indexOf(objectId);

        if (index > -1) {
            instanceList.splice(index, 1);
        }

        if (objectId in this.creationContexts)
            delete this.creationContexts[objectId];

        if (objectId in this.virtualInstances)
            delete this.virtualInstances[objectId];

        if (objectId in this.instancesById) {
            delete this.instancesById[objectId];
            return true;
        }
        else
            console.log(`Warning: destroyInstance() called for non-existant object [${objectId}]`);
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

    getInstanceCount(type) {
        type = typeof type === 'string' ? type : type.name;
        if (type in this.instancesByType) {
            return this.instancesByType[type].length;
        }
    }

    /**
     * Get all instances for the specified types
     * @param {...string} typeList
     */
    getInstances(...typeList) { 
        let result = [];

        if (!Array.isArray(typeList) || typeList.length === 0)
            typeList = Object.keys(this.instanceMap);

        typeList.forEach(type => {
            let instances = this.instancesByType[type];
            if (Array.isArray(instances) && instances.length > 0) {
                result.push(...instances);
            }
        });
        return result.map(m => this.instancesById[m]);
    }

    /**
     * Creates a weak reference to a particular MUDObject instance.
     * @param {PathExpr} req The instance request.
     * @returns {MUDWrapper} The specified instance.
     */
    getInstanceWrapper(req) {
        let { file, type, objectId, defaultType } = req;

        if (!objectId) {
            if (file in this.virtualInstances) {
                objectId = this.virtualInstances[file];
            }
            else if (defaultType === true) {
                if (true === this.defaultExport instanceof MUDObject) {
                    objectId = this.defaultExport.objectId;
                }
            }
            else if (type in this.instancesByType) {
                objectId = this.instancesByType[0];
            }
            else
                throw new Error(`getInstanceWrapper(): Unable to find suitable object instance`);
        }

        if (objectId in this.instancesById) {
            return this.getWrapperForContext({
                filename: this.instancesById[objectId].filename,
                objectId: objectId
            });
        }
        return false;
    }

    /**
     * Create information required to create a new MUDObject instance.
     * @param {string|function} type The type to fetch a constructor context for.
     * @param {number} idArg Specify the instance ID.
     * @returns {{ filename: string, objectId: string, args: any[], isSingleton: boolean, typeName: string }} Information needed by MUDObject constructor.
     */
    getNewContext(type, idArg, args) {
        let typeName = typeof type === 'function' ? type.name : typeof type === 'string' ? type : false,
            objectId = driver.efuns.getNewId(),
            typeInfo = this.typeDefinitions[typeName],
            isSingleton = typeInfo.isSingleton === true;

        if (isSingleton && typeName in this.instancesByType) {
            let currentId = this.instancesByType[typeName][0] || false,
                context = currentId && this.creationContexts[currentId];
            if (context) {
                context.args = args || context.args;
                return context;
            }
        }

        let filename = this.fullPath + '$' + typeName;
        
        let result = {
            args: args || [],
            objectId,
            filename,
            fullPath: this.fullPath,
            isSingleton,
            module: this,
            typeName: type.name
        };

        result.wrapper = this.getWrapperForContext(result);

        return result;
    }

    getSingleton(type) {
        let typeInfo = this.typeDefinitions[type.name];

        if (typeInfo && typeInfo.isSingleton) {
            let instances = this.instancesByType[type.name];

            if (Array.isArray(instances)) {
                return this.instancesById[instances[0]];
            }
        }
        return false;
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

    getWrapperForContext(ctx) {
        let { objectId, filename } = ctx;

        let wrapper = (() => {
            return () => {
                let instance = this.instancesById[objectId];
                if (instance) {
                    if (instance === -1 || instance.destructed) {
                        instance = -1;
                        throw new Error(`Object ${objectId} has been destructed [Invalid Wrapper]`);
                    }
                    return instance;
                }
                else
                    throw new Error(`Object ${objectId} has been destructed [Invalid Wrapper]`);
            };
        })();

        Object.defineProperties(wrapper, {
            filename: {
                value: filename,
                writable: false
            },
            fullPath: {
                value: this.fullPath,
                writable: false
            },
            instance: {
                get: () => {
                    return wrapper();
                },
                enumerable: false
            },
            isWrapper: {
                value: true,
                writable: false,
                enumerable: false
            },
            objectId: {
                value: objectId,
                writable: false
            },
            wrapper: {
                value: wrapper,
                writable: false,
                enumerable: false
            }
        });
        Object.freeze(wrapper);
        return wrapper;
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

    /**
     * Begin a new type definition within the module
     * @param {string} typeName The name of the type being created
     * @param {number} modifiers Access modifiers specified by the type
     * @param {{ char:number, line:number }} pos The position of the declaration in the source file
     * @returns
     */
    eventBeginTypeDefinition(typeName, modifiers, pos) {
        let typeDef = this.currentTypeDef = new MUDModuleTypeInfo(this, typeName, modifiers, pos);

        this.typeDefinitions[typeName] = typeDef;

        return typeDef;
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
        if (options.noCreate === false) {
            for (const [oid, instance] of Object.entries(this.instancesById)) {
                let ctx = this.creationContexts[oid];
                if (ctx && ctx.typeName in this.typeDefinitions) {
                    let cloneOutput = `\t\t\tRe-creating instance of ${instance.filename}...`;

                    try {
                        await this.createInstanceAsync(this.types[ctx.typeName], ctx, ctx.args, false, false, true);
                        cloneOutput += '[OK]';
                    }
                    catch (err) {
                        cloneOutput += `[Error: ${err}]`;
                    }
                    finally {
                        options.onDebugOutput(cloneOutput, 4);
                    }
                }
            }
        }
        if (options.reloadDependents) {
            for (const mod of this.dependents) {
                try {
                    let childOptions = options.createChildOptions(mod.fullPath),
                        fso = await driver.efuns.fs.getFileAsync(mod.fullPath);

                    await fso.compileAsync(childOptions);

                    options.onDebugOutput(`\tUpdating dependent module: ${mod.filename}: [Ok]`, 3);
                }
                catch (err) {
                    options.onDebugOutput(`\tUpdating dependent module: ${mod.filename}: Error: ${err}`, 3);
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
    eventSealTypes() {
        this.types && Object.keys(this.types)
            .forEach(tn => Object.freeze(this.types[tn]));
        return this;
    }

    /**
     * Fetch information about a type defined within the module
     * @param {string} typeName
     * @returns {MUDModuleTypeInfo} Returns type information
     */
    getTypeDefinition(typeName) {
        return this.typeDefinitions[typeName];
    }
}

module.exports = MUDModule;
