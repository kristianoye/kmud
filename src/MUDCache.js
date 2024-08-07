﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDModule = require('./MUDModule'),
    path = require('path'),
    MUDCompilerOptions = require('./compiler/MUDCompilerOptions'),
    { PipelineContext } = require('./compiler/PipelineContext');

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
                    this.length--;
                }
                return true;
            }
        }
        return false;
    }

    forEach(callback) {
        for (const [filename, module] of Object.entries(this)) {
            if (module instanceof MUDModule) {
                callback(module, filename);
            }
        }
    }

    /**
     * Fetch a previously compiled module.
     * @param {String} filename The name of the file to fetch from the cache.
     * @returns {MUDModule|boolean} Returns a previously compiled object.
     */
    get(filename) {
        return filename ? this[filename] || false : false;
    }

    /**
     * Gets an existing module or creates a new one and returns it.
     * @param {PipelineContext} context The compiler pipeline context
     * @param {boolean} isVirtual Is the module a virtual type?
     * @param {MUDCompilerOptions} options The compiler options being used.
     * @param {MUDModule} [parent] If this is a virtual object it needs a parent module.
     * @returns {MUDModule} The module
     */
    getOrCreate(context, isVirtual, options, parent = false) {
        let filename = context.fullPath;
        let module = this[filename];
        if (!module) {
            this[filename] = module = new MUDModule(context, isVirtual, options, parent);
            this.moduleNames.push(filename);
        }
        context.module = module;
        return module;
    }

    /**
     * Attempt to fetch a class definition.
     * @param {string} file The module that defines the type.
     * @param {string} typeName The name of the class being referenced.
     */
    getType(filename, typeName) {
        let module = this.get(filename) || driver.compiler.compileObject({ file: filename });
        return module && module.getType(typeName);
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
        if (!this[module.fullPath]) {
            this[module.fullPath] = module;
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
