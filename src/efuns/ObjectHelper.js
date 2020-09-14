/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 16, 2019
 * 
 * Various object-related efuns
 */

class ObjectHelper {
    /**
     * Clone an object asyncronously 
     * @param {string | MUDObject | MUDWrapper} expr The item to clone
     * @param {...any[]} args Arguments to pass to the constructor
     */
    static cloneObjectAsync(expr, ...args) {
        return driver.fileManager.cloneObjectAsync(expr, args);
    }

    static getLoadededModules(filter = undefined) {
        let result = driver.cache.moduleNames.slice(0);
        if (typeof filter === 'function')
            return result.filter(s => filter(s) !== false);

        return result;
    }

    static getLoadedTypes(filter = undefined) {
        let result = [];

        driver.cache.moduleNames.forEach(filename => {
            let module = driver.cache.get(filename),
                typeList = module.getTypes();
            result.push(...typeList);
        });

        if (typeof filter === 'function')
            return result.filter(s => filter(s) !== false);

        return result;
    }

    static getObjects(filter = undefined) {
        let result = [];

        driver.cache.moduleNames.forEach(filename => {
            let module = driver.cache.get(filename),
                instances = module.getInstances();

            if (instances.length)
                result.push(...instances);
        });

        if (typeof filter === 'function')
            return result.filter(s => filter(s) !== false);

        return result;
    }

    /**
     * Which groups does the user belong to
     * @param {MUDObject|MUDWrapper} target
     * @returns {string[]} Returns a list of groups
     */
    static getGroups(target = false) {
        let ecc = driver.getExecution(),
            ob = unwrap(target || ecc.thisObject),
            storage = ob && driver.storage.get(ob);

        return storage && storage.groups || [];
    }

    /**
     * Load or reload an object.
     * @param {string} expr The path expression to load
     * @param {number} flags Additional flags to control the operation
     */
    static async reloadObjectAsync(expr, flags = 0) {
        return await driver.efuns.fs.loadObjectAsync(expr, flags);
    }
}

Object.defineProperties(ObjectHelper, {
    OB_RELOAD: { value: 1, writable: false }
});

module.exports = ObjectHelper;