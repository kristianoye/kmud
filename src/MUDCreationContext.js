/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var
    MUDData = require('./MUDData');

const
    ignoredMixins = ['constructor', 'permissions', 'basename', 'directory', 'filename'];

class MUDCreationContext {
    constructor(instanceId, filename, isReload, instanceWrapper, startupData, dir) {
        this._args = {};
        this._directory = dir;
        this._forceCleanup = false;
        this._mixins = [];
        this._props = {};
        this.$storage = null;
        this._shared = {};
        this._symbols = {};
        this._wrapper = instanceWrapper;
        this.isReload = isReload;

        if (typeof startupData === 'object') {
            this._args = startupData.args || {};
            this._props = startupData.props || {};
            this._shared = startupData.shared || {};
        }

        function setter(col, key, value) {
            if (typeof key === 'object') {
                Object.keys(key).forEach(k => {
                    if (typeof col[k] === 'undefined') {
                        col[k] = key[k];
                    }
                });
            }
            else if (typeof key === 'string') {
                if (typeof col[key] === 'undefined')
                    col[key] = value;
            }
            else if (typeof key === 'symbol') {
                col[key] = value;
            }
            return this;
        }

        Object.defineProperties(this, {
            filename: {
                value: filename,
                writable: false
            },
            getKeyId: {
                get: function () {
                    var self = this;
                    return function (o) {
                        var m = /class\s+([^\s]+)/.exec(o.constructor),
                            fn = self.filename;
                        if (!m) return [];
                        if (!fn)
                            throw new ErrorTypes.BadModuleError('Class ' + m[1] + ' must exist in its own file');
                        var result = [fn, '.', self.instanceId].join('');
                        return result;
                    };
                }
            },
            instanceId: {
                value: instanceId,
                writable: false
            },
            isReload: {
                value: isReload || false,
                writable: false
            },
            prop: {
                get: function () {
                    var self = this;
                    return function (key, value) {
                        return setter.call(self, self._props, key, value);
                    };
                }
            },
            shared: {
                get: function () {
                    var self = this;
                    return function (key, value) {
                        return setter.call(self, self._shared, key, value);
                    };
                }
            },
            symbols: {
                get: function () {
                    return function (key, value) {
                        if (typeof key !== 'symbol')
                            throw new Error('Bad argument 1 to symbols');
                        return setter.call(this, this._symbols, key, value);
                    };
                }
            }
        });
    }

    addMixin(filename, self) {
        var resolved = MUDData.SpecialRootEfun.resolvePath(filename, this._directory),
            module = MUDData.ModuleCache.get(resolved),
            proto = MUDData.SpecialRootEfun.isClass(self) ? self.prototype : self.constructor.prototype,
            mixins = proto._mixins || false;

        if (!mixins) {
            mixins = proto._mixins = {};
        }
        if (resolved in mixins) {
            if (!this.isReload) {
                return;
            }
        }

        if (!module || this.isReload) {
            compileObject(resolved, this.isReload);
            module = MUDData.ModuleCache.get(resolved);
        }
        if (module) {
            Object.getOwnPropertyNames(module.classRef.prototype).forEach(pn => {
                if (ignoredMixins.indexOf(pn) === -1) {
                    var desc = Object.getOwnPropertyDescriptor(module.classRef.prototype, pn);
                    if ('set' in desc && 'get in desc') {
                        Object.defineProperty(proto, pn, {
                            get: desc.get,
                            set: desc.set
                        });
                    }
                    else {
                        proto[pn] = module.classRef.prototype[pn];
                    }
                }
            });
            mixins[resolved] = true;
        } else {
            throw new Error('Failed to create required mixin: ' + m);
        }
        return this;
    }

    forceCleanUpdate(flag) {
        if (typeof flag !== 'boolean')
            throw new Error(`Bad argument 1 to forceCleanUpdate(); Expected boolean got ${typeof flag}`);
        this._forceCleanup = flag;
        return this;
    }

    hasArg(key) {
        var result = (typeof this._args[key] !== 'undefined');
        return result;
    }

    hasSymbol(key) {
        return typeof this._symbols[key] !== 'undefined';
    }

    takeArg(key, defaultValue, preserve) {
        if (typeof this._args[key] !== 'undefined') {
            var result = this._args[key];
            if (preserve !== true) delete this._args[key];
            return result;
        }
        return defaultValue || undefined;
    }

    wrapper() {
        return this._wrapper;
    }
}

module.exports = MUDCreationContext;
