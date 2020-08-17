﻿/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var
    GameServer = require('./GameServer'),
    MUDEventEmitter = require('./MUDEventEmitter');

var
    useAuthorStats = false,
    useDomainStats = false,
    useStats = false;

/**
 * Contains information about a previously loaded MUD module.
 */
class MUDModule extends MUDEventEmitter {
    /**
     * 
     * @param {string} filename The name of the file?
     * @param {string} absFsPath The full filesystem path
     * @param {string} mudpath The full mud path
     * @param {boolean} isVirtual Is this a virtual request?
     * @param {boolean} [isMixin] Is this a mixin module?
     * @param {MUDModule} [parent] If this is a virtual object it needs a parent
     */
    constructor(filename, absFsPath, mudpath, isVirtual, isMixin = false, parent = false) {
        super();

        /**
         * Contains reference to all the child modules that inherit this module.
         * @type {MUDModule[]} */
        this.children = [];

        this.context = null;

        this.$defaultExport = false;

        /** @type {string[]} */
        this.typeNames = [];

        /** @type {Object.<string,function>} */
        this.types = { length: 0 };

        this.exports = { length: 0 };

        /** @type {Object.<string,MUDObject[]> */
        this.instanceMap = {};

        /** @type {MUDObject[]} */
        this.instances = [];

        this.isMixin = isMixin === true;

        this.directory = mudpath;

        this.filename = filename;

        this.name = filename.slice(filename.lastIndexOf('/') + 1);

        this.fullPath = absFsPath;

        this.isVirtual = isVirtual;

        /** @type {boolean} */
        this.loaded = false;

        /** @type {MUDModule} */
        this.parent = null;

        this.singleton = false;

        /** @type {Object.<string,boolean> */
        this.singletons = {};

        driver.preCompile(this);

        if (parent) {
            parent.on('recompile', () => {
                /* the module should rebuild all instances */
            });
        }
    }

    get defaultExport() {
        return this.$defaultExport;
    }

    set defaultExport(val) {
        this.$defaultExport = val;
    }

    insertInstance(item, typeArg) {
        let instanceId = item.instanceId,
            typeName = typeArg ? typeArg.name : item.constructor.name,
            instances = this.instanceMap[typeName] || [];
        instances[instanceId] = item;
        this.instanceMap[typeName] = instances;
    }

    addExportElement(val, key = false) {
        if (!key) {
            if (efuns.isClass(val)) key = val.name;
            else if (val instanceof MUDObject) key = val.constructor.name;
            else if (typeof val === 'function') key = val.name;
        }

        this.exports.length++;
        this.singletons[key] = val instanceof MUDObject;

        if (this.exports.length === 1)
            this.defaultExport = val;
        else if (key === this.name)
            this.defaultExport = val;
        else
            this.defaultExport = false;

        this.exports[key] = val;
    }

    addExport(val) {
        if (Array.isArray(val)) {
            val.forEach(a => this.addExportElement(a));
        }
        else if (val instanceof MUDObject) {
            this.addExportElement(val, val.constructor.name);
        }
        else if (typeof val === 'object') {
            Object.keys(val).forEach(key => this.addExportElement(val[key], key));
        }
        else if (efuns.isClass(val)) {
            this.addExportElement(val, val.name);
        }
        else if (typeof val === 'function') {
            this.addExportElement(val, val.name);
        }
    }

    /**
     * Create an instance of an object
     * @param {string} file The module name to create from
     * @param {string} [typeName] The type to construct
     * @param {any} [args] Arguments to pass to the constructor
     */
    async createInstanceAsync(file, typeName, args) {
        //  Sanity check
        if (file !== this.filename)
            return false;
        //  No type name matching filename was found; Use first available if only one exists
        else if (!typeName || typeName in this.types === false) {
            if (this.defaultExport instanceof MUDObject)
                return this.defaultExport;
            if (this.typeNames.length === 1) {
                typeName = this.typeNames[0];
            }
            else return false;
        }
        //  The module exported an instance of this type; This indicates the item cannot be cloned
        if (this.singletons[typeName] === true)
            throw new Error(`Type ${typeName} is a singleton and cannot be cloned.`);

        let type = this.types[typeName],
            createContext = this.getNewContext(typeName, true, args);

        await this.createAsync(type, createContext, args);

        return this.getInstanceWrapper({
            file,
            type: typeName,
            instance: createContext.instanceId
        });

    }

    create(type, instanceData, args = [], create = false) {
        try {
            // Storage needs to be set before starting...
            let store = driver.storage.createForId(instanceData.filename || instanceData.$type),
                ecc = driver.getExecution(),
                prev = ecc.previousObject;

            if (typeof type === 'string') {
                if (type in this.exports === false) {
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
                }
                type = this.types[type];
            }

            ecc.newContext = instanceData;
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

    async createAsync(type, instanceData, args = [], create = false) {
        try {
            if (typeof type === 'string') {
                if (type in this.exports === false) {
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

            ecc.newContext = instanceData;
            ecc.storage = store;

            let instance = create ? create(type, ...args) : new type(...args);
            this.finalizeInstance(instance, !instance.filename && instanceData);
            if (typeof instance.create === 'function') {
                driver.driverCall('create', () => {
                    instance.create();
                }, instance.filename, true);
            }
            if (typeof instance.createAsync === 'function') {
                await driver.driverCallAsync('createAsync', async () => {
                    return await instance.createAsync();
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

    createInstances(isReload) {
        // TODO: Optionally flag to enable creating instance 0... seems silly, now
        //Object.keys(this.types).forEach(typeName => {
        //    let type = this.types[typeName];
        //    if (type.prototype instanceof MUDObject) {
        //        if (isReload || !this.instanceMap[typeName][0]) {
        //            let ecc = driver.getExecution();
        //            if (!ecc)
        //                throw new Error('No execution context is currently running');
        //            ecc.newContext = this.getNewContext(type, 0);
        //            this.create(type, this.getNewContext(type, 0));
        //        }
        //    }
        //});
    }

    createObject(id, creationContext) {
        try {
            return this.isMixin ?
                new this.classRef() :
                new this.classRef(creationContext);
        }
        catch (err) {
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
            if (store && !store.destroyed)
                return store.destroy();
            return true;
        }
        return false;
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
        else if (!this.types[req.type]) {
            return req.instance === 0 && this.defaultExport;
        }
        let instances = this.instanceMap[req.type] || [];
        if (req.instance < 0 || req.instance > instances.length)
            return false;
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
     * Request a specific instance of a type.
     * @param {PathExpr} req The instance request.
     * @returns {MUDWrapper} The specified instance.
     */
    getInstanceWrapper(req) {
        let instance = this.getInstance(req);

        if (instance) {
            let wrapper = (() => {
                let instance = false;
                return () => {
                    if (instance) {
                        if (instance === -1 || instance.destructed) {
                            instance = -1;
                            throw new Error(`Object ${req.file} has been destructed [Invalid Wrapper]`);
                        }
                        return instance;
                    }

                    this.once('recompiled', () => {
                        let typeName = instance.constructor.name;
                        instance = this.instanceMap[typeName][req.instance] =
                            this.create(this.getType(typeName), {
                                filename: req.file,
                                instanceId: req.instance,
                                isVirtual: instance && instance.isVirtual
                            });
                    });
                    return instance = this.getInstance(req);
                };
            })();

            Object.defineProperties(wrapper, {
                filename: {
                    value: instance.filename,
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
        return { filename, instanceId, args: args || [] };
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
     * Determines if the module is related to this module.
     * @param {MUDModule} module The module to check.
     * @returns {boolean} True if the module is related.
     */
    isRelated(module) {
        if (module === this)
            return true;
        for (let i = 0, max = this.children.length; i < max; i++) {
            if (this.children[i].isRelated(module))
                return true;
        }
        let parent = this.parent;
        while (parent) {
            if (parent === module) return true;
            parent = parent.parent;
        }
        return false;
    }

    /**
     * Fires when a module is updated in-game.  This process makes sure that
     * all in-game instances are also updated and that child modules and
     * child instances are updated as well.
     */
    recompiled() {
        this.emit('recompiled', this);
        // TODO: Re-implement recompile logic
        //async.forEach(this.instances, (item, callback) => {
        //    var instanceId = item.instanceId;
        //    if (instanceId > 0) {
        //        logger.log('Updating instance...');
        //        this.createInstance(instanceId, true, []);
        //    }
        //    callback();
        //}, err => {
        //    if (err) {
        //        logger.log('There was an error during re-compile: ' + err);
        //    }
        //    else {
        //        logger.log('All instances updated, recompiling children...');
        //        async.forEach(this.children, (childName, innerCallback) => {
        //            try {
        //                logger.log('Re-compiling ' + childName.filename);
        //                driver.compiler.compileObject({ file: childName.filename, reload: true });
        //            }
        //            catch (e) {
        //                driver.errorHandler(e, false);
        //            }
        //            innerCallback();
        //        }, err => {
        //            logger.log('All children of ' + this.filename + ' have been updated');
        //        });
        //    }
        //});
    }

    resetModule() {
        this.exports = { length: 0 };
        this.singletons = {};
        this.typeNames = [];
        this.types = { length: 0 };
        this.defaultExport = false;
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

/**
 * Configure this module for runtime.
 * @param {GameServer} driver The active game driver
 */
MUDModule.configureForRuntime = function (driver) {
    useAuthorStats = driver.config.driver.featureFlags.authorStats === true;
    useDomainStats = driver.config.driver.featureFlags.domainStats === true;
    useStats = useAuthorStats | useDomainStats;
    if (useStats) DomainStats = require('./features/DomainStats');
};

module.exports = MUDModule;
