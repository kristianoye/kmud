/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    ignoredMixins = ['constructor', 'permissions', 'basename', 'directory', 'filename'];

class MUDCreationContext {
    constructor(instanceId, filename, isReload, instanceWrapper, startupData, dir) {
        this.args = {};
        this.directory = dir;
        this.forceCleanup = false;
        this.mixins = [];
        this.private = {};
        this.props = {};
        this.protected = {};
        this.$storage = null;
        this.shared = {};
        this.symbols = {};
        this._wrapper = instanceWrapper;
        this.isReload = isReload;

        if (isNaN(instanceId))
            throw new Error('Illegal instanceId!');

        if (typeof startupData === 'object') {
            this.args = startupData.args || {};
            this.props = startupData.props || {};
            this.protected = startupData.protected || {};
            this.private = startupData.private || {};
            this.shared = startupData.shared || {};
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
                        return setter.call(self, self.props, key, value);
                    };
                }
            },
            shared: {
                get: function () {
                    var self = this;
                    return function (key, value) {
                        return setter.call(self, self.shared, key, value);
                    };
                }
            },
            symbols: {
                get: function () {
                    return function (key, value) {
                        if (typeof key !== 'symbol')
                            throw new Error('Bad argument 1 to symbols');
                        return setter.call(this, this.symbols, key, value);
                    };
                }
            }
        });
    }

    forceCleanUpdate(flag) {
        if (typeof flag !== 'boolean')
            throw new Error(`Bad argument 1 to forceCleanUpdate(); Expected boolean got ${typeof flag}`);
        this.forceCleanup = flag;
        return this;
    }

    hasArg(key) {
        var result = (typeof this.args[key] !== 'undefined');
        return result;
    }

    hasSymbol(key) {
        return typeof this.symbols[key] !== 'undefined';
    }

    takeArg(key, defaultValue, preserve) {
        if (typeof this.args[key] !== 'undefined') {
            var result = this.args[key];
            if (preserve !== true) delete this.args[key];
            return result;
        }
        return defaultValue || undefined;
    }

    wrapper() {
        return this._wrapper;
    }
}

module.exports = MUDCreationContext;
