/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var
    GameServer = require('./GameServer'),
    MUDCreationContext = require('./MUDCreationContext'),
    async = require('async');

var
    creationContext = false,
    useAuthorStats = false,
    useDomainStats = false,
    useStats = false;

/**
 * Contains information about a previously loaded MUD module.
 */
class MUDModule {
    /**
     * 
     * @param {string} filename The name of the file?
     * @param {string} absFsPath The full filesystem path
     * @param {string} mudpath The full mud path
     * @param {boolean} isVirtual Is this a virtual request?
     * @param {boolean} isMixin Is this a mixin module?
     */
    constructor(filename, absFsPath, mudpath, isVirtual, isMixin) {
        /**
         * Contains reference to all the child modules that inherit this module.
         * @type {MUDModule[]} */
        this.children = [];

        this.context = null;

        this.defaultInstance = false;

        /** @type {Object.<string,function>} */
        this.types = false;

        this.exports = false;

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

        this.singletons = false;

        this.wrappers = [null];

        driver.preCompile(this);
    }

    insertInstance(item, typeArg) {
        let instanceId = item.instanceId,
            typeName = typeArg ? typeArg.name : item.constructor.name,
            instances = this.instanceMap[typeName] || [];
        instances[instanceId] = item;
        this.instanceMap[typeName] = instances;
    }

    addExport(val) {
        let newTypes = {}, // defined types in the module
            singles = {},  // which types are singletons?
            sc = 0,
            prev = this.exports;

        //  Step 1: Do we have exports already? In which case we need to create an export mapping
        if (prev) {
            let newExports = {};
            if (typeof prev === 'object') {
                if (this.efuns.isPOO(prev)) {
                    newExports = Object.assign(newExports, prev);
                }
                else {
                    let o = prev, c = o.constructor;
                    if (c) {
                        newExports[c.name] = o;
                        newTypes[c.name] = c;
                        singles[c.name] = ++sc;
                        this.insertInstance(prev, c);
                    }
                }
            }
            else if (Array.isArray(prev)) {
                prev.forEach(ex => {
                    if (typeof ex === 'object') {
                        let c = ex.constructor;
                        if (c) {
                            newExports[c.name] = ex;
                            newTypes[c.name] = c;
                            singles[c.name] = ++sc;
                            this.insertInstance(ex, c);
                        }
                        else {
                            newExports = Object.assign(newExports, ex);
                        }
                    }
                    else if (typeof ex === 'function') {
                        newExports[ex.name] = ex;
                    }
                    else
                        throw new Error(`Illegal exports; Cannot merge exports of type ${typeof ex}`);
                });
            }
            else if (prev === 'function') {
                newExports[prev.name] = prev;
                newTypes[prev.name] = prev;
                sc++;
            }
            else
                throw new Error(`Unable to merge additional exports with type ${typeof this.exports}`);

            if (typeof val === 'object') {
                if (this.efuns.isPOO(val)) {
                    newExports = Object.assign(newExports, val);
                }
                else {
                    let c = val.constructor;
                    this.classRef = this.classRef || c || false;
                    this.singleton = this.singleton || c && true;

                    if (c) {
                        newTypes[c.name] = c;
                        newExports[c.name] = val;
                        this.insertInstance(val, c);
                    }
                }
            }
            else if (efuns.isClass(val)) {
                this.classRef = this.classRef || val;
                newTypes[val.name] = val;
            }

            this.exports = newExports;
        }
        //  Step 2: Create new exports entry
        else {
            this.exports = val;
            if (typeof val === 'object') {
                if (!this.efuns.isPOO(val)) {
                    let c = val.constructor;
                    newTypes[c.name] = c;
                    singles[c.name] = ++sc;
                    this.insertInstance(val, c);
                }
                else {
                    Object.keys(this.exports).forEach(key => {
                        let exp = this.exports[key];
                        if (this.efuns.isClass(exp)) {
                            newTypes[exp.name] = exp;
                        }
                        else if (exp instanceof MUDObject) {
                            let c = exp.constructor;
                            newTypes[c.name] = c;
                            singles[c.name] = ++sc;
                            this.insertInstance(exp, c);
                        }
                    });
                }
            }
            else if (this.efuns.isClass(val)) {
                newTypes[val.name] = val;
                this.defaultInstance = val;
            }
        }
        this.types = newTypes;
        this.singletons = sc > 0 && singles;
    }

    createInstance(file, typeName, args) {
        if (file !== this.filename)
            return false;
        else if (!typeName || !this.types[typeName]) {
            if (typeof this.defaultInstance === 'function') {
                typeName = this.defaultInstance.name;
            }
            else return false;
        }
        if (this.singletons[typeName])
            throw new Error(`Type ${typeName} is a singleton and cannot be cloned.`);
        let ecc = driver.getExecution(), type = this.types[typeName],
            instanceList = this.instanceMap[typeName] || [],
            createContext = this.getNewContext(typeName, true, args);

        ecc.newContext = createContext;
        instanceList[createContext.instanceId] = new type(...args);
        this.instanceMap[typeName] = instanceList;

        return this.getInstanceWrapper({
            file,
            type: typeName,
            instance: createContext.instanceId
        });

    }

    createInstances(isReload) {
        Object.keys(this.types).forEach((typeName, i) => {
            let type = this.types[typeName];
            if (type.prototype instanceof MUDObject) {
                let instances = this.instanceMap[typeName] || [];
                if (isReload || !instances[0]) {
                    let ctx = driver.executionContext;
                    if (!ctx)
                        throw new Error('No execution context is currently running');
                    ctx.newContext = this.getNewContext(type, 0);
                    instances[0] = new type();
                    this.instanceMap[typeName] = instances;
                }
                this.defaultInstance = i === 0 && instances[0];
            }
        });
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

    destroyInstance(t) {
        let targetId = unwrap(t, ob => this.instances.indexOf(ob)) || t;
        var id = t.instanceId;
        this.wrappers[id] = null;
        this.instances[id] = null;
    }

    /**
     * Request a specific instance of a type.
     * @param {PathExpr} req The instance request.
     * @returns {MUDObject} The specified instance.
     */
    getInstance(req) {
        if (typeof req === 'number') {
            req = { type: this.name, instance: req, file: this.fullPath };
        }
        if (req.file !== this.fullPath && req.file !== this.filename)
            return false;
        else if (!this.types[req.type]) {
            return req.instance === 0 && this.defaultInstance;
        }
        let instances = this.instanceMap[req.type] || [];
        if (req.instance < 0 || req.instance > instances.length)
            return false;
        return instances[req.instance];
    }

    /**
     * Request a specific instance of a type.
     * @param {PathExpr} req The instance request.
     * @returns {MUDWrapper} The specified instance.
     */
    getInstanceWrapper(req) {
        let instance = this.getInstance(req);

        if (instance) {
            let wrapper = () => {
                return this.getInstance(req);
            };
            Object.defineProperties(wrapper, {
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
        if (instanceId > 0) filename += '#' + instanceId;
        return { filename, instanceId, args };
    }

    /**
     * Get a type defined within the module.
     * @param {string} name The name of the type to retrieve.
     * @returns {function} Returns the constructor for the specified type.
     */
    getType(name) {
        return name && this.types[name] || this.types[this.name] || false;
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
        async.forEach(this.instances, (item, callback) => {
            var instanceId = item.instanceId;
            if (instanceId > 0) {
                logger.log('Updating instance...');
                this.createInstance(instanceId, true, []);
            }
            callback();
        }, err => {
            if (err) {
                logger.log('There was an error during re-compile: ' + err);
            }
            else {
                logger.log('All instances updated, recompiling children...');
                async.forEach(this.children, (childName, innerCallback) => {
                    try {
                        logger.log('Re-compiling ' + childName.filename);
                        driver.compiler.compileObject({ file: childName.filename, reload: true });
                    }
                    catch (e) {
                        driver.errorHandler(e, false);
                    }
                    innerCallback();
                }, err => {
                    logger.log('All children of ' + this.filename + ' have been updated');
                });
            }
        });
    }

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
