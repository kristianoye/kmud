/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var
    GameServer = require('./GameServer'),
    MUDCreationContext = require('./MUDCreationContext'),
    MUDLoader = require('./MUDLoader'),
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
     * @param {string} fullPath The full filesystem path
     * @param {string} mudpath The full mud path
     * @param {boolean} isVirtual Is this a virtual request?
     * @param {boolean} isMixin Is this a mixin module?
     */
    constructor(filename, fullPath, mudpath, isVirtual, isMixin) {
        /**
         * Contains reference to all the child modules that inherit this module.
         * @type {MUDModule[]} */
        this.children = [];

        this.context = null;

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

        this.fullPath = fullPath;

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
            }
            else if (this.efuns.isClass(val)) {
                this.classRef = val;

                newTypes[val.name] = val;
                singles[val.name] = ++sc;
            }
        }
        this.types = newTypes;
        this.singletons = sc > 0 && singles;
    }

    /**
     * Creates an instance of an object.
     * @param {number} instanceId The instance ID being generated.
     * @param {boolean} isReload Indicates whether object is being reloaded
     * @param {object} args Arguments to pass to the object constructor
     * @param {MUDObject} instance An instance is already created.  It needs context.
     * @returns {MUDObject|false} Returns a new instance wrapper or false on failure.
     */
    createInstance(instanceId, isReload, args, instance) {
        let prevContext = creationContext,
            nextId = this.instances.length,
            oldInstance = instanceId > -1 ? this.instances[instanceId] || false : false,
            thisInstanceId = instanceId === -1 ? nextId : instanceId,
            needContext = typeof instance === 'object';

        try {
            let instanceWrapper = this.getWrapper(thisInstanceId, isReload);
            creationContext = new MUDCreationContext(
                thisInstanceId,
                this.filename,
                isReload,
                instanceWrapper,
                args,
                this.directory);

            if (!instance)
                instance = false;

            if (instanceId === -1) {
                if (this.singleton)
                    throw 'That object cannot be cloned!';
                if (!instance)
                    instance = this.createObject(thisInstanceId, creationContext);
                this.instances.push(instance);
                instanceId = nextId;
            }
            else {
                if (instanceId > nextId)
                    throw 'Instance does not exist!  This should not happen!';

                if (oldInstance) {
                    oldInstance.destroy(isReload);
                }
                if (!instance)
                    instance = this.createObject(thisInstanceId, creationContext);
                this.instances[instanceId] = instance;
            }
            if (this.isMixin) {
                return instanceWrapper;
            }
            let store = needContext && driver.storage.get(instance);

            !needContext && instance.create(store);

            if (this.stats && !this.isMixin) {
                store.stats = this.stats;
                this.stats.objects++;
                this.stats.arrays += store.getSizeOf();
            }

            Object.defineProperty(instance, 'wrapper', {
                value: instanceWrapper,
                writable: false,
                enumerable: false
            });

            driver.registerReset(instanceWrapper, false, store);

            return needContext ? creationContext : instanceWrapper;
        }
        catch (_e) {
            throw _e;
        }
        finally {
            creationContext = prevContext;
        }
    }

    createInstances(isReload) {
        Object.keys(this.types).forEach(typeName => {
            let type = this.types[typeName];
            if (type.prototype instanceof MUDObject) {
                let instances = this.instanceMap[typeName] || [];
                if (isReload || !instances[0]) {
                    let ctx = driver.getExecution();
                    ctx.newContext = this.getNewContext(type, 0);
                    instances[0] = new type();
                    this.instanceMap[typeName] = instances;
                }
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
        if (req.file !== this.fullPath)
            throw new Error(`Bad argument 1 to getInstance(); Path mismatch ${req.file} vs ${this.fullPath}`);
        let instances = this.instanceMap[req.type] || [];
        if (!this.types[req.type])
            throw new Error(`Module ${this.fullPath} does not appear to define type ${req.type}`);
        else if (req.instance < 0 || req.instance > instances.length)
            throw new Error(`Module ${this.fullPath} does not have that many ${req.type} instance(s)`);
        return instances[req.instance];
    }

    /**
     * Create information required to create a new MUDObject instance.
     * @param {string|function} type The type to fetch a constructor context for.
     * @param {number} idArg Specify the instance ID.
     * @returns {{ filename: string, instanceId: number }} Information needed by MUDObject constructor.
     */
    getNewContext(type, idArg) {
        let typeName = typeof type === 'function' ? type.name
            : typeof type === 'string' ? type : false;

        let instanceId = typeof idArg === 'number' ? idArg : (this.instanceMap[typeName] || []).length,
            filename = this.filename + (this.name !== typeName ? '$' + typeName : '');
        if (instanceId > 0) filename += '#' + instanceId;
        return { filename, instanceId };
    }

    /**
     * Get a type defined within the module.
     * @param {string} name The name of the type to retrieve.
     * @returns {function} Returns the constructor for the specified type.
     */
    getType(name) {
        return name && this.types[name] || this.types[this.name] || false;
    }

    getWrapper(arg) {
        if (typeof arg === 'object') {

        }
        let wrapper = this.wrappers[n] = () => {
            let result = this.instances[n];
            if (!result) {
                this.createInstance(n, true);
                result = this.instances[n];
            }
            return result;
        };
        return wrapper;
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
