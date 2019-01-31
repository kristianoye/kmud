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

        this.classRef = null;

        this.context = null;

        /** @type {Object.<string,function>} */
        this.types = false;

        this.exports = false;

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

        /** @type {MUDLoader} */
        this.loader = null;

        /** @type {MUDModule} */
        this.parent = null;

        this.singleton = false;

        this.singletons = false;

        this.wrappers = [null];

        driver.preCompile(this);
    }

    addExport(val) {
        //  Step 1: Do we have exports already? In which case we need to create an export mapping
        if (this.exports) {
            let newExports = {}, newTypes = {}, singles = {}, sc = 0, old = this.exports;
            if (typeof old === 'object') {
                let o = this.exports, c = o.constructor;
                if (c) {
                    newExports[c.name] = o;
                    newTypes[c.name] = c;
                    singles[c.name] = true;
                }
                else
                    newExports = Object.assign(newExports, o);
            }
            else if (Array.isArray(this.exports)) {
                this.exports.forEach(ex => {
                    if (typeof ex === 'object') {
                        let c = ex.constructor;
                        if (c) {
                            newExports[c.name] = ex;
                            newTypes[c.name] = c;
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
            else if (typeof this.exports === 'function') {
                let f = this.exports;
            }
            else throw new Error(`Unable to merge additional exports with type ${typeof this.exports}`);

            if (typeof val === 'object') {
                let c = val.constructor;
                this.classRef = this.classRef || c || false;
                this.singleton = this.singleton || c && true;

                if (c) {
                    this.types[c.name] = c;
                    newExports[c.name] = val;
                }
            }
            else if (efuns.isClass(val)) {
                this.classRef = this.classRef || val;
                this.types[val.name] = val;
            }

            this.exports = newExports;
            this.types = newTypes;
        }
        //  Step 2: Create new exports entry
        else {
            this.exports = val;
            if (typeof val === 'object') {
                let c = val.constructor;
                this.classRef = c || false;
                this.singleton = c && true;
                if (c) this.types[c.name] = c;
            }
            else if (efuns.isClass(val)) {
                this.classRef = val;
                this.types[val.name] = val;
            }
        }
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
     * Get a type defined within the module.
     * @param {string} name
     * @returns {object}
     */
    getType(name) {
        return this.loader && this.loader.getType(name);
    }

    getWrapper(n, isReload) {
        if (typeof n === 'object') {
            n = this.instances.indexOf(n);
        }
        let wrapper = this.wrappers[n];
        if (!wrapper) {
            wrapper = this.wrappers[n] = () => {
                let result = this.instances[n];
                if (!result) {
                    this.createInstance(n, true);
                    result = this.instances[n];
                }
                return result;
            };
            wrapper._isWrapper = true;
        }
        return wrapper;
    }

    /**
     * Import a module into the global scope.
     * @param {Object.<string,any>} target The namespace to import to.
     */
    importScope(target) {
        let exports = {}, count = 0;
        if (this.context !== null) {
            Object.keys(this.context.exports).forEach(name => {
                exports[name] = target[name] = this.context.exports[name];
                count++;
            });
        }
        return count === 1 ? this.context.primaryExport : exports;
    }

    /**
     * 
     * @param {MUDModule} module
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
