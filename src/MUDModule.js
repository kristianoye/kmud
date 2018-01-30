/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var
    MUDConfig = require('./MUDConfig'),
    GameServer = require('./GameServer'),
    EFUNProxy = require('./EFUNProxy'),
    MUDCreationContext = require('./MUDCreationContext'),
    MUDLoader = require('./MUDLoader'),
    async = require('async'),
    vm = require('vm');

var
    creationContext = false,
    DomainStats = false,
    useProxies = false,
    useAuthorStats = false,
    useDomainStats = false,
    useStats = false;

/**
 * Contains information about a previously loaded MUD module.
 */
class MUDModule {
    constructor(filename, fullPath, mudpath, isVirtual) {
        this.allowProxy = false;

        /**
         * Contains reference to all the child modules that inherit this module.
         * @type {MUDModule[]} */
        this.children = [];

        this.classRef = null;

        this.context = null;

        this.efunProxy = EFUNProxy.createEfunProxy(filename, mudpath);

        /** @type {MUDObject[]} */
        this.instances = [];

        /** @type {string} */
        this.directory = mudpath;

        /** @type {string} */
        this.filename = filename;

        /** @type {string} */
        this.fullPath = fullPath;

        /** @type {boolean} */
        this.isVirtual = isVirtual;

        /** @type {boolean} */
        this.loaded = false;

        /** @type {MUDLoader} */
        this.loader = null;

        /** @type {MUDModule} */
        this.parent = null;

        this.proxies = [null];

        this.singleton = false;

        this.wrappers = [null];

        driver.preCompile(this);
    }

    /**
     * Creates an instance of an object.
     * @param {number} instanceId The instance ID being generated.
     * @param {boolean} isReload Indicates whether object is being reloaded
     * @param {object} args Arguments to pass to the object constructor
     */
    createInstance(instanceId, isReload, args) {
        let prevContext = creationContext,
            nextId = this.instances.length,
            oldInstance = instanceId > -1 ? this.instances[instanceId] || false : false,
            thisInstanceId = instanceId === -1 ? nextId : instanceId;

        try {
            var instanceWrapper = this.getWrapper(thisInstanceId, isReload);
            creationContext = new MUDCreationContext(
                thisInstanceId,
                this.filename,
                isReload,
                instanceWrapper,
                args,
                this.directory);

            var instance = null; // new this.classRef(creationContext);
            if (true) {
                if (instanceId === -1) {
                    if (this.singleton)
                        throw 'That object cannot be cloned!';
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
                    instance = this.createObject(thisInstanceId, creationContext);
                    this.instances[instanceId] = instance;
                }
                if (useProxies) {
                    this.proxies[instanceId] = this.getProxy(instanceId, isReload);
                }
                let store = driver.storage.get(instance);

                instance.create(store);

                if (this.stats) {
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

                return instanceWrapper;
            }
            creationContext = prevContext;
        }
        catch (_e) {
            creationContext = prevContext;
            throw _e;
        }
        return false;
    }

    destroyInstance(t) {
        let targetId = unwrap(t, ob => this.instances.indexOf(ob)) || t;
        var id = t.instanceId;
        this.wrappers[id] = null;
        this.instances[id] = null;
    }

    getProxy(n, isReload) {
        var self = this,
            proxy = this.proxies[n];

        if (!proxy || isReload) {
            this.proxies[n] = proxy = (function (_this) {
                var _proxy = new Proxy(_this, {
                    apply: function (target, thisArg, argList) {
                        return driver.addObjectFrame(_this, () => {
                            return Reflect.apply(_this, thisArg, argList);
                        });
                    },
                    construct: function () {
                        throw new Error('Illegal operation');
                    },
                    defineProperty: function (target, property, descriptor) {
                        return driver.addObjectFrame(_this, () => {
                            return Reflect.defineProperty(target, property, descriptor);
                        });
                    },
                    deleteProperty: function (target, property) {
                        return driver.addObjectFrame(_this, () => {
                            return Reflect.deleteProperty(target, property);
                        });
                    },
                    get: function (target, property, receiver) {
                        const originalMethod = _this[property];

                        if (property === 'wrapper')
                            return _this.wrapper;

                        if (typeof originalMethod === 'function') {
                            return function (...args) {
                                return driver.addObjectFrame(_this, () => {
                                    return originalMethod.apply(this, args);
                                });
                            };
                        }
                        return Reflect.get(_this, property, receiver);
                    },
                    getOwnPropertyDescriptor: function (target, property) {
                        return driver.addObjectFrame(_this, () => {
                            return Object.getOwnPropertyDescriptor(_this, property);
                        });
                    },
                    getPrototypeOf: function (target) {
                        return driver.addObjectFrame(_this, () => {
                            return Object.getPrototypeOf(_this);
                        });
                    },
                    has: function (target, prop) {
                        return driver.addObjectFrame(_this, () => {
                            return prop in _this;
                        });
                    },
                    isExtensible: function (target) {
                        return false;
                    },
                    ownKeys: function (target) {
                        return driver.addObjectFrame(_this, () => {
                            return Reflect.ownKeys(_this);
                        });
                    },
                    preventExtensions: function (target) {
                        Object.preventExtensions(_this);
                        return true;
                    },
                    set: function (target, prop, value, receiver) {
                        return driver.addObjectFrame(_this, () => {
                            target[prop] = value;
                            return true;
                        });
                    },
                    setPrototypeOf: function (target, prototype) {
                        throw new Error('Access violation');
                    }
                });
                return _proxy;
            })(this.instances[n]);
        }
        return proxy;
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
        var self = this,
            wrapper = this.wrappers[n];

        if (!wrapper) {
            if (useProxies) {
                wrapper = this.wrappers[n] = (function (_n) {
                    return function () {
                        var result = self.allowProxy ? self.proxies[_n] : self.instances[_n];
                        if (!result) {
                            self.createInstance(_n, true);
                            result = self.allowProxy ? self.proxies[_n] : self.instances[_n];
                        }
                        return result;
                    };
                })(n);
            }
            else {
                wrapper = this.wrappers[n] = (function (_n) {
                    return function () {
                        var result = self.instances[_n];
                        if (!result) {
                            self.createInstance(_n, true);
                            result = self.instances[_n];
                        }
                        return result;
                    };
                })(n);
            }
            wrapper._isWrapper = true;
        }
        return wrapper;
    }

    /**
     * Import a module into the global scope.
     * @param {any} target
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

    setClassRef(cr) {
        var module = this;

        module.classRef = cr;

        Object.defineProperties(cr.prototype, {
            basename: {
                value: module.efunProxy.filename,
                writable: false
            },
            directory: {
                value: module.efunProxy.directory,
                writable: false
            },
            filename: {
                get: function () {
                    return module.efunProxy.filename + (this.instanceId ? '#' + this.instanceId : '');
                }
            },
            permissions: {
                value: module.efunProxy.permissions,
                writable: false
            }
        });
        Object.defineProperties(cr, {
            filename: {
                get: function () { return module.efunProxy.filename; }
            }
        });
        if (module.isVirtual) {
            let parent = driver.cache.resolve(module.fullPath);
            if (parent) {
                module.parent = parent;
                parent.children.pushDistinct(module);
            }
        }
        else if (cr.prototype) {
            if (cr.prototype.__proto__) {
                if (cr.prototype.__proto__.constructor) {
                    if (cr.prototype.__proto__.constructor.filename) {
                        let pfn = cr.prototype.__proto__.constructor.filename,
                            parent = driver.cache.get(pfn);
                        if (parent) {
                            module.parent = parent;
                            parent.children.pushDistinct(module);
                        }
                    }
                }
            }
        }
    }
}

/**
 * Configure this module for runtime.
 * @param {GameServer} driver The active game driver
 */
MUDModule.configureForRuntime = function (driver) {
    useProxies = driver.config.driver.useObjectProxies;
    useAuthorStats = driver.config.driver.featureFlags.authorStats === true;
    useDomainStats = driver.config.driver.featureFlags.domainStats === true;
    useStats = useAuthorStats | useDomainStats;
    if (useStats) DomainStats = require('./features/DomainStats');

    var creationContext = new MUDCreationContext(0);

    let objectCreationMethod = driver.config.driver.objectCreationMethod;

    if (objectCreationMethod === 'inline') {
        MUDModule.prototype.createObject = function (id, creationContext) {
            return new this.classRef(creationContext);
        };
    }
    else if (objectCreationMethod === 'thinWrapper') {
        MUDModule.prototype.createObject = function (id, creationContext) {
            let scriptSource = `(function($ctx) {  
                        class WrapperType extends ${this.classRef.name} { 
                            constructor(ctx) { super(ctx); }

                        }
                        return new WrapperType($ctx);
                    })`.trim();
            let script = new vm.Script(scriptSource, {
                filename: creationContext.filename + (id !== 0 ? '#' + id : '')
            });
            let foo = script.runInContext(this.context);
            return foo(creationContext);
        };
    }
    else if (objectCreationMethod === 'fullWrapper') {
        MUDModule.prototype.createObject = function (id, creationContext) {
            let moduleName = this.classRef.name,
                methodBlock = Object.getOwnPropertyNames(this.classRef.prototype).filter(propId => {
                    if (propId === 'constructor') return false;
                    var desc = Object.getOwnPropertyDescriptor(this.classRef.prototype, propId);
                    return typeof desc.value === 'function';
                }).concat(['preprocessInput']).map(name => `\t${name}() { return super.${name}.apply(this, arguments); }\n`).join('\n');
            let scriptSource = [`
(function($ctx, $storage) {  
    class ${moduleName}Wrapper extends ${this.classRef.name} { 
        constructor(ctx) { super(ctx); }
`.trim(),
                methodBlock,
            `}

    return new ${moduleName}Wrapper($ctx);
})`].join('\n');
            let options = {
                displayErrors: true,
                filename: creationContext.filename + (id !== 0 ? '#' + id : ''),
                lineOffset: 1
            };
            if (driver.config.driver.compiler.maxConstructorTime > 0) {
                options.timeout = driver.config.driver.compiler.maxConstructorTime;
            }
            let script = new vm.Script(scriptSource, options);
            let foo = script.runInContext(this.context);            
            let instance = foo(creationContext, driver.storage.createForId(creationContext.filename, id));
            return instance;
        };
    }
};

module.exports = MUDModule;
