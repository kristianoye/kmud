﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDModule = require('./MUDModule'),
    path = require('path');

/**
 * Contains information about all loaded MUD modules.
 */
class MUDCache {
    constructor() {
        this.length = 0;
        this.moduleNames = [];
    }

    /**
     * Remove a module from the cache
     * @param {string} filename The name of the module to unload
     */
    delete(filename) {
        let module = this[filename] || false;
        if (module) {
            if (!module.loaded) {
                delete this[filename];
                let index = this.moduleNames.indexOf(filename);
                if (index > -1) {
                    this.moduleNames.splice(index, 1);
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Fetch a previously compiled module.
     * @param {String} filename The name of the file to fetch from the cache.
     * @returns {MUDModule|boolean} Returns a previously compiled object.
     */
    get(filename) {
        filename = this.normalize(filename);
        return filename ? this[filename] || false : false;
    }

    /**
     * Gets an existing module or creates a new one and returns it.
     * @param {string} filename The filename of the module.
     * @param {string} fullPath The full path
     * @param {string} muddir The mud directory
     * @param {boolean} isVirtual Is the module a virtual type?
     * @param {boolean} [isMixin] Is the module expected to be a mixin type?
     * @param {MUDModule} [parent] If this is a virtual object it needs a parent
     * @returns {MUDModule} The module
     */
    getOrCreate(filename, fullPath, muddir, isVirtual, isMixin = false, parent = false) {
        filename = this.normalize(filename);
        let module = this[filename];
        if (!module) {
            this[filename] = module = new MUDModule(filename, fullPath, muddir, isVirtual, isMixin, parent);
            this.moduleNames.push(filename);
        }
        return module;
    }

    /**
     * Attempt to fetch a class definition.
     * @param {string} file The module that defines the type.
     * @param {string} typeName The name of the class being referenced.
     */
    getType(file, typeName) {
        let filename = this.normalize(file),
            module = this.get(filename) || driver.compiler.compileObject({ file: filename });
        return module && module.getType(typeName);
    }

    /**
     * Normalizes a cache entry filename.
     * @param {String} filename The filename to normalize.
     * @returns {String} The normalized filename
     */
    normalize(filename) {
        if (typeof filename !== 'string') {
            throw new Error(`Bad argument 0 to normalize; Expected string got ${(typeof filename)}`);
        }
        filename = (filename || '').replace(/\/{2,}/g, '/');
        if (filename.endsWith('.js'))
            filename = filename.slice(0, filename.length - 3);
        return filename;
    }

    /**
     * Resolve a module from the cache
     * @param {string} file
     * @returns {MUDModule}
     */
    resolve(file) {
        let expr = driver.fileManager.toMudPath(file) || file,
            norm = expr && expr.replace(new RegExp('/' + path.sep + '/', 'g'), '/');
        return norm && this.get(norm);
    }

    store(module) {
        if (!this[module.filename]) {
            this[module.filename] = module;
            this.length++;
        }
        return this;
    }
}

/**
 * @param {GameServer} driver 
 */
MUDCache.configureForRuntime = function (driver) {
    /* nothing to do atm */
};

module.exports = MUDCache;
