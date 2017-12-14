﻿/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var
    MUDData = require('./MUDData'),
    EFUNProxy = require('./EFUNProxy'),
    MUDCreationContext = require('./MUDCreationContext'),
    ObjectProxy = require('./ObjectProxy'),
    vm = require('vm');

/**
 * Contains information about a previously loaded MUD module.
 */
class MUDModule {
    constructor(filename, fullPath, mudpath, isVirtual) {
        var self = this, _classRef = null;

        this.allowProxy = false;
        this.children = [];
        this.classRef = null;
        this.context = null;
        this.efunProxy = EFUNProxy.createEfunProxy(filename, mudpath);
        this.instances = [null];
        this.directory = mudpath;
        this.filename = filename;
        this.fullPath = fullPath;
        this.isVirtual = isVirtual;
        this.loaded = false;
        this.loader = null;
        this.parent = null;
        this.proxies = [null];
        this.singleton = false;
        this.wrappers = [null];
    }

    /**
     * Creates an instance of an object.
     * @param {number} instanceId The instance ID being generated.
     * @param {boolean} isReload Indicates whether object is being reloaded
     * @param {object} args Arguments to pass to the object constructor
     */
    createInstance(instanceId, isReload, args) {
        var prevContext = creationContext,
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

            var instance = new this.classRef(creationContext);
            if (instance) {
                if (instanceId === -1) {
                    if (this.singleton)
                        throw 'That object cannot be cloned!';
                    this.instances.push(instance);
                    instanceId = nextId;
                }
                else {
                    if (instanceId >= nextId)
                        throw 'Instance does not exist!  This should not happen!';
                    if (oldInstance) {
                        oldInstance.destroy(isReload);
                    }
                    this.instances[instanceId] = instance;
                }
                this.proxies[instanceId] = this.getProxy(instanceId, isReload);
                instance.create(MUDData.Storage.get(instance));

                Object.defineProperty(instance, 'wrapper', {
                    value: instanceWrapper,
                    writable: false,
                    enumerable: false
                });
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
                        return MUDData.PushStack(_this, () => {
                            return Reflect.apply(_this, thisArg, argList);
                        });
                    },
                    construct: function () {
                        throw new Error('Illegal operation');
                    },
                    defineProperty: function (target, property, descriptor) {
                        return MUDData.PushStack(_this, () => {
                            return Reflect.defineProperty(target, property, descriptor);
                        });
                    },
                    deleteProperty: function (target, property) {
                        return MUDData.PushStack(_this, () => {
                            return Reflect.deleteProperty(target, property);
                        });
                    },
                    get: function (target, property, receiver) {
                        const originalMethod = _this[property];

                        if (property === 'wrapper')
                            return _this.wrapper;

                        if (typeof originalMethod === 'function') {
                            return function (...args) {
                                return MUDData.PushStack(_this, () => {
                                    return originalMethod.apply(this, args);
                                });
                            };
                        }
                        return Reflect.get(_this, property, receiver);
                    },
                    getOwnPropertyDescriptor: function (target, property) {
                        return MUDData.PushStack(_this, () => {
                            return Object.getOwnPropertyDescriptor(_this, property);
                        });
                    },
                    getPrototypeOf: function (target) {
                        return MUDData.PushStack(_this, () => {
                            return Object.getPrototypeOf(_this);
                        });
                    },
                    has: function (target, prop) {
                        return MUDData.PushStack(_this, () => {
                            return prop in _this;
                        });
                    },
                    isExtensible: function (target) {
                        return false;
                    },
                    ownKeys: function (target) {
                        return MUDData.PushStack(_this, () => {
                            return Reflect.ownKeys(_this);
                        });
                    },
                    preventExtensions: function (target) {
                        Object.preventExtensions(_this);
                        return true;
                    },
                    set: function (target, prop, value, receiver) {
                        return MUDData.PushStack(_this, () => {
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

    getWrapper(n, isReload) {
        if (typeof n === 'object') {
            n = this.instances.indexOf(n);
        }
        var self = this,
            wrapper = this.wrappers[n];

        if (!wrapper) {
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
            wrapper._isWrapper = true;
        }
        return wrapper;
    }

    importScope(target) {
        if (this.context !== null) {
            Object.keys(this.context.exports).forEach(name => {
                target[name] = this.context.exports[name];
            });
        }
    }

    recompiled() {
        async.forEach(this.instances, (item, callback) => {
            var instanceId = item.instanceId;
            if (instanceId > 0) {
                console.log('Updating instance...');
                this.createInstance(instanceId, true, []);
            }
            callback();
        }, err => {
            if (err) {
                console.log('There was an error during re-compile: ' + err);
            }
            else {
                console.log('All instances updated, recompiling children...');
                async.forEach(this.children, (childName, innerCallback) => {
                    try {
                        console.log('Re-compiling ' + childName.filename);
                        compileObject(childName, true);
                    }
                    catch (e) { }
                    innerCallback();
                }, err => {
                    console.log('All children of ' + this.filename + ' have been updated');
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
        if (cr.prototype) {
            if (cr.prototype.__proto__) {
                if (cr.prototype.__proto__.constructor) {
                    if (cr.prototype.__proto__.constructor.filename) {
                        var pfn = cr.prototype.__proto__.constructor.filename,
                            parent = MUDData.ModuleCache.get(pfn);
                        if (parent) {
                            module.parent = parent;
                            parent.children.pushDistinct(module);
                        }
                    }
                }
            }
        }
    }

    setContext(ctx) {
        this.context = ctx;
        this.loader.ctx = ctx;
    }
}

var creationContext = new MUDCreationContext(0);

module.exports = MUDModule;
