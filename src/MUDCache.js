/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var
    MUDData = require('./MUDData'),
    MUDModule = require('./MUDModule');

/**
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
        var module = this[filename];
        if (!module) {
            this[filename] = module = new MUDModule(filename, fullPath, muddir, isVirtual);
        }
        return module;
    }

    /**
     * Normalizes a cache entry filename.
     * @param {String} filename The filename to normalize.
     * @returns {String} The normalized filename
     */
    normalize(filename) {
        if (typeof filename !== 'string') {
            throw new Error('Bad argument 0 to normalize; Expected string got {0}'.fs(typeof filename));
        }
        filename = (filename || '').replace(/\/{2,}/g, '/');
        if (filename.endsWith('.js')) filename = filename.slice(0, filename.length - 3);
        return filename;
    }

    addInstance(filename, inst) {
        return this;
    }

    store(module) {
        if (!this[module.filename]) {
            this[module.filename] = module;
            this.length++;
        }
        return this;
    }
}

module.exports = MUDData.ModuleCache = new MUDCache();

