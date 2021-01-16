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

    /**
     * Get objects currently loaded in the MUD.
     * @param {function(MUDObject):boolean} filter A method used to filter the results
     * @returns {MUDObject[]} Matching objects
     */
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
     * Load an object asyncronously
     * @param {any} expr
     * @param {...any} args
     */
    static async loadObjectAsync(expr, ...args) {
        if (expr instanceof MUDObject)
            return expr;

        if (typeof expr !== 'string') {
            if (typeof expr === 'function' && expr.isWrapper)
                return expr;
            else if (expr instanceof MUDObject)
                return global.wrap(expr);
        }
        let result = await driver.fileManager.loadObjectAsync(driver.efuns.resolvePath(expr), args);
        return result;
    }

    /**
     * Load or reload an object.
     * @param {string} expr The path expression to load
     * @param {number} flags Additional flags to control the operation
     */
    static async reloadObjectAsync(expr, ...args) {
        return await driver.fileManager.loadObjectAsync(driver.efuns.resolvePath(expr), args, 1);
    }
}

Object.defineProperties(ObjectHelper, {
    OB_RELOAD: { value: 1, writable: false }
});

module.exports = ObjectHelper;