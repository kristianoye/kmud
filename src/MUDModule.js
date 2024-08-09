/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDObject = require('./MUDObject'),
    { ExecutionContext, CallOrigin } = require('./ExecutionContext'),
    SimpleObject = require('./SimpleObject'),
    MUDCompilerOptions = require('./compiler/MUDCompilerOptions'),
    { PipelineContext } = require('./compiler/PipelineContext'),
    CreationContext = require('./CreationContext'),
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

/** 
 * @typedef {{ char: number, file:string, line: number }} MUDFilePosition 
 */

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

        /** @type {typeof MUDObject} */
        this.typeRef = undefined;
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

    /**
     * 
     * @param {ExecutionContext} ecc
     * @param {any} typeRef
     * @param {any} typeAlias
     */
    importTypeInfo(ecc, typeRef, typeAlias) {
        let frame = ecc.push({ file: this.filename, method: 'importTypeInfo' });
        try {
            let info = driver.efuns.parsePath(frame.branch(), typeRef.prototype.baseName),
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
        finally {
            frame.pop();
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

    setConcreteType(type) {
        this.typeRef = type;
        return this;
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

        /** @type {Object.<string,any>} */
        this.$exports = { length: 0 };

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
        this.filename = context.fullPath;

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
        let ecc = ExecutionContext.current;
        if (driver.efuns.isClass(ecc.branch(), val)) {
            let flags = val.prototype.typeModifiers || 0;

            if ((flags & MemberModifiers.Singleton) > 0)
                this.$defaultExport = new val();
            else
                this.$defaultExport = val;
        }
        else
            this.$defaultExport = val;
    }

    /**
     * 
     * @param {ExecutionContext} ecc
     * @param {any} val
     */
    async setDefaultExport(ecc, val) {
        let frame = ecc.push({ method: 'setDefaultExport', file: this.filename, isAsync: true, callType: CallOrigin.Driver });
        try {
            if (driver.efuns.isClass(frame.branch(), val)) {
                let flags = val.prototype.typeModifiers;

                if ((flags & MemberModifiers.Singleton) > 0) {
                    let inst = await this.createInstanceAsync(frame.branch(), val, false, [], false, this.filename);
                    this.$defaultExport = inst;
                }
                else
                    this.$defaultExport = val;
            }
            else
                this.$defaultExport = val;
        }
        finally {
            frame.pop();
        }
    }

    addExportElement(val, key = false, isDefault = false) {
        if (!key) {
            if (efuns.isClass(undefined, val)) key = val.name;
            else if (val instanceof MUDObject) key = val.constructor.name;
            else if (val instanceof SimpleObject) key = val.constructor.name;
            else if (typeof val === 'function') key = val.name;
        }

        this.$exports.length++;
        this.singletons[key] = val instanceof MUDObject || val instanceof SimpleObject;

        if (isDefault === false && this.explicitDefault === false) {
            if (key === this.name)
                this.defaultExport = val;
        }
        else if (isDefault === true) {
            this.defaultExport = val;
            this.explicitDefault = true;
        }

        this.$exports[key] = val;
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

    /**
     * 
     * @param {ExecutionContext} ecc
     * @param {any} type
     * @param {CreationContext} instanceData
     * @param {any[]} args
     * @param {any} factory
     * @param {any} callingFile
     * @param {any} isReload
     * @returns
     */
    async createInstanceAsync(ecc, typeSpec, instanceData, args, factory = false, callingFile = false, isReload = false) {
        let frame = ecc.push({ file: __filename, method: 'createInstanceAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let instance = false,
                store = false,
                isType = false,
                type;

            if (typeof typeSpec === 'string' && !this.isVirtual) {
                if (typeSpec in this.$exports === false) {
                    //  Always allow module to create its own types
                    if (callingFile === this.filename) {
                        type = this.types[typeSpec];
                    }
                    else if (typeSpec in this.types === false) {
                        if (this.$exports.length === 1 && this.$defaultExport)
                            type = this.$defaultExport;
                        else if (typeSpec in this.typeDefinitions) {
                            type = this.typeDefinitions[typeSpec].typeRef;
                            isType = true;
                        }
                        else
                            throw new Error(`Unable to find type ${typeSpec}`);
                    }
                    else
                        type = this.types[typeSpec];
                }
                else
                    type = this.types[typeSpec];
                isType = true;
            }
            else if (typeof typeSpec === 'function' && typeSpec.toString().startsWith('class ')) {
                type = typeSpec;
            }

            if (instance === false) {
                let virtualContext = ecc && ecc.popVirtualCreationContext();

                if (virtualContext) {
                    if (isType === false) {
                        type = this.types[typeSpec.type];
                    }

                    await this.getNewContext(frame.context, type, undefined, virtualContext);

                    // virtualContext.module = this;
                    // virtualContext.trueName = this.filename + '$' + type.name + '#' + virtualContext.objectId;
                    // virtualContext.typeName = type.name;
                    return await this.createInstanceAsync(frame.branch({ hint: 'this.createInstanceAsync' }), type, virtualContext, args);
                }

                if (!type)
                    throw new Error(`getNewContent() could not resolve type '${type}' in module ${this.fullPath}`);

                if (!instanceData) {
                    instanceData = await this.getNewContext(frame.context, type, args);
                }
                else {
                    //  Ensure instanceData is complete
                }

                if (!instanceData.wrapper)
                    instanceData.wrapper = this.getWrapperForContext(instanceData);

                let constructorFrame = frame
                    .branch({ hint: 'constructor' })
                    .push({ object: instance, method: 'constructor', file: this.filename, callType: CallOrigin.Constructor });

                try {
                    let constructorArgs = [instanceData, constructorFrame.context, ...args];

                    constructorFrame.context.addCreationContext(instanceData);
                    constructorFrame.context.storage = instanceData.store;

                    //  Having the context as the first argument is an edge case
                    //  constructorArgs.unshift(constructorFrame.context, constructorFrame.context);
                    instance = factory ? factory(...constructorArgs) : new type(...constructorArgs);
                    this.addInstance(instance, type, instanceData);
                }
                finally {
                    constructorFrame.pop();
                }

                if (typeof this.compilerOptions.onInstanceCreated === 'function') {
                    this.compilerOptions.onInstanceCreated(instance);
                }

                if (typeof instance.create === 'function') {
                    await instance.create(frame.branch({ hint: 'instance.create' }), ...args);
                }
                if (typeof instance.setup === 'function') {
                    await instance.setup(frame.branch({ hint: 'instance.setup' }));
                }
                if (instanceData.store !== false && instance !== false)
                    await instanceData.store.eventInitialize(ecc.branch({ hint: 'store.eventInitialize' }), instance);
            }

            return instance;
        }
        catch (err) {
            /* rollback object creation */
            driver.storage.delete(instanceData?.filename);
            throw err;
        }
        finally {
            frame.pop();
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
        return typeof this.$exports === 'object' ? Object.assign({}, this.$exports) : {};
    }

    set exports(spec) {
        if (spec === false)
            this.$exports = {};
        else if (typeof spec === 'object') {
            for (const [key, val] of Object.entries(spec)) {
                this.$exports[key] = val;
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
                else if (type in this.instancesByType) {
                    let instances = this.instancesByType[type];
                    if (Array.isArray(instances) && instances.length)
                        objectId = instances[0];
                }
            }
            else if (type in this.instancesByType) {
                objectId = this.instancesByType[0];
            }
            else
                return false;
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
     * @param {ExecutionContext} ecc The current callstack
     * @param {string|function} type The type to fetch a constructor context for.
     * @param {any[]} args Arguments to pass the constructor
     * @param {Partial<CreationContext>} virtualContext A partially created context
     * @returns {CreationContext} Information needed by MUDObject constructor.
     */
    async getNewContext(ecc, type, args, virtualContext = false) {
        const frame = ecc.push({ file: __filename, method: 'getNewContext', callType: CallOrigin.Driver });
        try {
            let typeName = typeof type === 'function' ? type.name : typeof type === 'string' ? type : false,
                objectId = virtualContext?.objectId || driver.efuns.getNewId(),
                typeInfo = this.typeDefinitions[typeName],
                isSingleton = typeInfo?.isSingleton === true;

            if (!typeInfo)
                throw new Error(`getNewContent() could not resolve type '${type}' in module ${this.fullPath}`);

            if (isSingleton && typeName in this.instancesByType) {
                let currentId = this.instancesByType[typeName][0] || false,
                    context = currentId && this.creationContexts[currentId];

                if (context) {
                    context.args = args || context.args;
                    return context;
                }
            }

            const filename = this.fullPath + '$' + typeName,
                store = driver.storage.createForId(frame.context, objectId, this.fullPath),
                credential = driver.masterObject && await driver.securityManager.getCredential(frame.context.branch({ hint: 'getCredential' }), virtualContext?.filename || this.fullPath);

            let result = {
                args: args || [],
                objectId,
                filename,
                fullPath: this.fullPath || this.filename,
                identity: credential?.userId,
                isSingleton,
                module: this,
                store,
                typeName: type.name
            };

            result.wrapper = this.getWrapperForContext(result);

            if (virtualContext) {
                virtualContext.fullPath = result.fullPath;
                virtualContext.typeName = type.name;
                virtualContext.store = store;
                virtualContext.identity = credential.userId;
                virtualContext.module = this;
                virtualContext.trueName = filename;
                virtualContext.wrapper = result.wrapper;
                return virtualContext;
            }
            return new CreationContext(result);
        }
        finally {
            frame.pop();
        }
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
        if (!name) {
            if (driver.efuns.isClass(undefined, this.defaultExport))
                return this.defaultExport;
        }
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
            /** @param {ExecutionContext} ecc */
            return (ecc) => {
                let instance = this.instancesById[objectId];
                let frame = ecc && ecc.push({ object: instance, method: 'wrapper', file: filename, callType: CallOrigin.LocalCall });
                try {
                    if (instance) {
                        if (instance === -1 || instance.destructed) {
                            instance = -1;
                            throw new Error(`Object ${objectId} has been destructed [Invalid Wrapper]`);
                        }
                        return instance;
                    }
                    else
                        throw new Error(`Object ${objectId} has been destructed [Invalid Wrapper]`);
                }
                finally {
                    frame?.pop();
                }
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
     * End the current method definition
     */
    eventEndTypeDefinition() {
        delete this.currentTypeDef;
    }

    /**
     * Define a new type within the module
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} type
     */
    eventDefineType(ecc, type) {
        let frame = ecc.push({ file: this.filename, method: 'eventDefineType' });
        try {
            this.types[type.name] = type;
            this.typeNames.push(type.name);
            this.typeDefinitions[type.name].setConcreteType(type);

            if (type.name in this.instanceMap == false)
                this.instanceMap[type.name] = [];

            let parentType = Object.getPrototypeOf(type);
            if (parentType && typeof parentType.prototype.baseName === 'string' && parentType.prototype.baseName !== 'MUDObject') {
                let { file } = driver.efuns.parsePath(frame.branch(), parentType.prototype.baseName),
                    parentModule = driver.cache.get(file);

                parentModule.eventAddDependent(this);
                this.eventAddDependency(parentModule);
            }
        }
        finally {
            frame.pop();
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
                        fso = await driver.efuns.fs.getObjectAsync(mod.fullPath);

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

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     */
    eventResetModule(ecc) {
        let frame = ecc.push({ file: this.filename, method: 'eventResetModule' });
        try {
            this.$exports = { length: 0 };
            this.singletons = {};
            this.typeNames = [];
            this.types = {};
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
        finally {
            frame.pop();
        }
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
