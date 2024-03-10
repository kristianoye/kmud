/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 16, 2019
 * 
 * Various object-related efuns
 */

const MUDObject = require("../MUDObject"),
    CompilerFlags = require("../compiler/CompilerFlags");

class ObjectHelper {
    /**
     * Determine if one or more values are the same object reference.
     * @param {...any} args
     */
    static areEqual(...args) {
        let result = false;

        for (let i = 0; i < args.length; i++) {
            let a = args[i], fn;

            if (typeof a === 'string') fn = a;
            else if (typeof a === 'function') fn = a.filename;
            else if (typeof a === 'object') fn = a.filename;

            if (result && result !== fn) return false;
            else result = fn;
        }
        return true;
    }

    /**
     * Clone an object asyncronously 
     * @param {string | MUDObject | MUDWrapper} expr The item to clone
     * @param {...any[]} args Arguments to pass to the constructor
     */
    static cloneObjectAsync(expr, ...args) {
        return driver.fileManager.cloneObjectAsync(expr, args);
    }

    static compileObject(options) {
        return driver.fileManager.loadObjectAsync();
    }

    static get compilerFlags() {
        return CompilerFlags;
    }

    static async findObject(filename, flag = 0) {
        let module = driver.cache.get(filename);

        if (!module && flag === 1) {
            return await ObjectHelper.loadObjectAsync(filename);
        }
        if (!module)
            return false;
        let parts = driver.efuns.parsePath(filename);
        return module.getInstanceWrapper(parts);
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

        driver.cache.forEach(module => {
            let instances = module.getInstances();

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
     * @returns {Promise<MUDObject>}
     */
    static async loadObjectAsync(expr, ...args) {
        if (expr instanceof MUDObject)
            return expr;

        if (typeof expr !== 'string') {
            if (typeof expr === 'function' && expr.isWrapper)
                return expr;
            else if (expr instanceof MUDObject)
                return expr.wrapper;
        }
        let result = await driver.fileManager.loadObjectAsync(driver.efuns.resolvePath(expr), args);
        return result;
    }

    /**
     * Moves the current object to another location.
     * @param {string|MUDObject} destination
     * @returns {boolean} True if the move was succcessful.
     */
    static async moveObjectAsync(destination) {
        let thisObject = efuns.thisObject(),
            thisStorage = driver.storage.get(thisObject),
            current = thisStorage.environment,
            target = destination;

        if (target instanceof MUDObject === false) {
            if (typeof target === 'function' && target.isWrapper) {
                target = unwrap(target);
            }
            else {
                target = await ObjectHelper.loadObjectAsync(destination);
                target = unwrap(target);
            }
        }

        if (target && target.canAcceptItem(thisObject)) {
            if (!current || current.canReleaseItem(thisObject)) {
                let targetStorage = driver.storage.get(target);

                if (driver.config.driver.useLazyResets === true) {
                    if (typeof target.reset === 'function') {
                        if (targetStorage.nextReset < efuns.ticks) {
                            await driver.driverCallAsync('reset',
                                async () => await target.reset(),
                                target.filename);
                        }
                    }
                }

                if (targetStorage.addInventory(thisObject)) {
                    let inv = targetStorage.inventory,
                        isLiving = efuns.living.isAlive(thisObject),
                        ctx = driver.getExecution();

                    for (let i = 0; i < inv.length; i++) {
                        let item = inv[i];

                        //  Call init on all living items in the environment's inventory
                        if (efuns.living.isAlive(item)) {
                            await ctx.withPlayerAsync(item, async () => await thisObject.initAsync());
                        }
                        //  Call init on every object in the environment
                        if (isLiving) {
                            await ctx.withPlayerAsync(thisObject, async () => await item.initAsync());
                        }
                    }
                    //  If this object is living, call init in the new environment
                    if (isLiving) {
                        await ctx.withPlayerAsync(thisObject, async () => await target.initAsync());
                    }
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Query the security system for an objects privs
     * @param {MUDObject} target
     */
    static async queryPrivs(target) {
        return await driver.securityManager.queryPrivs(target);
    }

    /**
     * Load or reload an object.
     * @param {string} expr The path expression to load
     * @param {number} flags Additional flags to control the operation
     */
    static async reloadObjectAsync(expr, ...args) {
        return await driver.fileManager.loadObjectAsync(driver.efuns.resolvePath(expr), args, 1);
    }

    /**
     * Shameless clone of 'to_object' sefun from Blitz at Dead Souls.
     * Parse passed string argument and return a matching object.
     * ```
     *   Usage Examples:
     *     sword           (1st sword in inv or env)
     *     sword@here      (find sword in local env)
     *     sword#4         (find 4th sword)
     *     sword#2@foo     (find 2nd sword on player foo)
     *     sword@bag#2@foo (find 1st sword in foo's 2nd bag)
     *     ---------------
     *     /path/filename  (find or load filename)
     *     /path/file#999  (find unique cloned object)
     *     %foo            (explicitly find player foo)
     *     $foo            (explicitly find npc foo)
     *     @foo            (return foo's environment)
     *     
     *     tokens: me, here, sefun
     * ```
     *
     * @param {string} spec The object to find
     * @returns The matching object or false if nothing matches
     */
    static async resolveObject(spec) {
        let n = -1,
            tp = driver.efuns.thisPlayer(),
            ob = undefined,
            env = false;

        if (typeof spec === 'object' && spec instanceof MUDObject)
            return spec;
        else if (typeof spec === 'function' && spec.isWrapper)
            return spec.instance;
        else if (typeof spec !== 'string' || spec.length === 0)
            return false;
        else if ((n = spec.indexOf('@')) > 0) {
            let where = spec.slice(n + 1);

            spec = spec.slice(0, n);

            if (!(env = ObjectHelper.resolveObject(where)))
                return false;
            if (id.length === 0)
                return env.environment.instance;
        }
        switch (spec) {
            case 'here':
                return driver.efuns.thisPlayer().environment;
            case 'me':
                return driver.efuns.thisPlayer();
        }
        let m = /(?<id>[^#]+)#(?<index>\d+)/.exec(spec);
        if (m && m.length === 3) {
            if ((ob = await ObjectHelper.findObject(spec)))
                return ob.instance;
            n = m.groups.index;
            spec = m.groups.id;
        }
        else n = 1;
        if (n < 1)
            return false;
        let c = spec.slice(0, 1);
        if (['/', '$', '%'].indexOf(c) > -1) {
            spec = spec.slice(1);
        }
        switch (c) {
            case '/':
                if ((ob = await ObjectHelper.loadObjectAsync(spec)))
                    return ob.instance;
                else
                    return false;

            case '%':
                if ((ob = driver.efuns.living.findPlayer(spec)))
                    return ob.instance;
                else
                    return false;

            case '$':
                if (ob) {
                    let obs = ob.inventory.filter(o => {
                        if (!driver.efuns.living.isAlive(o))
                            return false;
                        else if (driver.efuns.living.isInteractive(o))
                            return false;
                        else return o.id(spec);
                    });
                    return obs.length < n ? obs[n - 1] : false;
                }
                else {
                    if ((ob = driver.efuns.living.findLiving(spec))) {
                        if (Array.isArray(ob)) {
                            let obs = ob.filter(o => !driver.efuns.living.isInteractive(o));
                            return obs.length < n ? obs[n - 1] : false;
                        }
                        else
                            return driver.efuns.living.isInteractive(ob) ? false : ob;
                    }
                    return false;
                }

            default:
                if (!env)
                    env = driver.efuns.thisPlayer();
                if (n > 1) {
                    let obs = env.inventory.filter(o => o.id(spec));
                    if (obs.length < n) {
                        if (!(env = env.environment))
                            ob = false;
                        else {
                            obs = env.inventory.filter(o => o.id(spec));
                            if (obs.length < n)
                                ob = false;
                            else
                                ob = obs[n - 1];
                        }
                    }
                    else
                        ob = obs[n - 1];
                    return ob;
                }
                else {
                    if ((ob = driver.efuns.present(spec, env)))
                        return ob;
                    else if ((env = env.environment)) {
                        if ((ob = driver.efuns.present(spec, env)))
                            return ob;
                    }
                    if ((ob = driver.efuns.living.findPlayer(spec)))
                        return ob;
                    if ((ob = driver.efuns.living.findLiving(spec)))
                        return ob;
                    if (!tp)
                        return false;
                    spec = driver.efuns.resolvePath(tp.workingDirectory, spec);
                    if ((ob = await ObjectHelper.loadObjectAsync(spec)))
                        return ob;
                    else
                        return false;
                }
                break;
        }
        return false;
    }
}

Object.defineProperties(ObjectHelper, {
    OB_RELOAD: { value: 1, writable: false }
});

module.exports = ObjectHelper;