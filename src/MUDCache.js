/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDModule = require('./MUDModule'),
    GameServer = require('./GameServer'),
    path = require('path');

/**
 * @class
 * Contains information about all loaded MUD modules.
 */
class MUDCache {
    constructor() {
        this.length = 0;
    }

    delete(filename) {
        var module = this[filename] || false;
        if (module) {
            if (!module.loaded) {
                delete this[filename];
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
     * @param {string} filename
     * @param {string} fullPath
     * @param {string} muddir
     * @param {boolean} isVirtual
     * @returns {MUDModule} The module
     */
    getOrCreate(filename, fullPath, muddir, isVirtual) {
        filename = this.normalize(filename);
        let module = this[filename];
        if (!module) {
            this[filename] = module = new MUDModule(filename, fullPath, muddir, isVirtual);
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
        if (filename.endsWith('.js')) filename = filename.slice(0, filename.length - 3);
        return filename;
    }

    addInstance(filename, inst) {
        return this;
    }

    /**
     * 
     * @param {string} file
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
    /**
     * Delete a module entry from the cache.
     * @param {string} name The module to delete from the cache.
     */
    MUDCache.delete = function (name) {
        return driver.cache.delete(name);
    };

    /**
     * Returns the singleton instance of the MUD cache.
     * @param {string} name The name of the module to fetch.
     * @returns {MUDModule} */
    MUDCache.get = function (name) {
        return driver.cache.get(name);
    };

    /**
     * Passthru
     */
    MUDCache.getOrCreate = function (filename, fullPath, muddir, isVirtual) {
        return driver.cache.getOrCreate(filename, fullPath, muddir, isVirtual);
    };

    /**
     * Stores a compiled module.
     * @param {MUDModule} module The module to store.
     */
    MUDCache.store = function (module) {
        return driver.cache.store(module);
    };
};

module.exports = MUDCache;
