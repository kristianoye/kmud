/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 16, 2019
 * 
 * Various object-related efuns
 */

const { ExecutionContext, CallOrigin } = require("../ExecutionContext");
const MUDObject = require("../MUDObject"),
    CompilerFlags = require("../compiler/CompilerFlags");

class ObjectHelper {
    /**
     * Clone an object asyncronously 
     * @param {ExecutionContext} ecc The current callstack
     * @param {string | MUDObject | MUDWrapper} expr The item to clone
     * @param {...any[]} args Arguments to pass to the constructor
     */
    static async cloneObjectAsync(ecc, expr, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'cloneObjectAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            return await driver.fileManager.cloneObjectAsync(expr, args);
        }
        finally {
            frame.pop();
        }
    }

    static get compilerFlags() {
        return CompilerFlags;
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} filename The file spec to locate
     * @param {any} flag
     * @returns
     */
    static async findObject(ecc, filename, flag = 0) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'findObject', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let module = driver.cache.get(filename);

            if (!module && flag === 1) {
                return await ObjectHelper.loadObjectAsync(frame.branch(), filename);
            }
            if (!module)
                return false;
            let parts = driver.efuns.parsePath(frame.branch(), filename);
            return module.getInstanceWrapper(parts);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {function(string): boolean} filter
     * @returns
     */
    static getLoadededModules(ecc, filter = undefined) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getLoadededModules', callType: CallOrigin.DriverEfun });
        try {
            let result = driver.cache.moduleNames.slice(0);
            if (typeof filter === 'function')
                return result.filter(s => filter(s) !== false);

            return result;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {function(string): boolean} filter
     * @returns
     */
    static getLoadedTypes(ecc, filter = undefined) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'resolveObject', callType: CallOrigin.DriverEfun });
        try {
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
        finally {
            frame.pop();
        }
    }

    /**
     * Get objects currently loaded in the MUD.
     * @param {ExecutionContext} ecc The current callstack
     * @param {function(MUDObject):boolean} filter A method used to filter the results
     * @returns {MUDObject[]} Matching objects
     */
    static getObjects(ecc, filter = undefined) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'resolveObject', callType: CallOrigin.DriverEfun });
        try {
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
        finally {
            frame.pop();
        }
    }

    /**
     * Which groups does the user belong to
     * @param {ExecutionContext} ecc The current callstack
     * @param {MUDObject|MUDWrapper} target
     * @returns {string[]} Returns a list of groups
     */
    static getGroups(ecc, target = false) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getGroups', callType: CallOrigin.DriverEfun });
        try {
            let ob = target?.instance ?? frame.context.thisObject,
                storage = ob && driver.storage.get(ob);

            return storage && storage.groups || [];
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Load an object asyncronously
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} expr
     * @param {...any} args
     * @returns {Promise<MUDObject>}
     */
    static async loadObjectAsync(ecc, expr, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'loadObjectAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            if (expr instanceof MUDObject)
                return expr;

            if (typeof expr !== 'string') {
                if (typeof expr === 'function' && expr.isWrapper)
                    return expr;
                else if (expr instanceof MUDObject)
                    return expr.wrapper;
            }
            let result = await driver.fileManager.loadObjectAsync(frame.branch(), driver.efuns.resolvePath(undefined, expr), args);
            return result;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Moves the current object to another location.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string|MUDObject} destination
     * @returns {boolean} True if the move was succcessful.
     */
    static async moveObjectAsync(ecc, destination) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'moveObjectAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let thisObject = efuns.thisObject(frame.context),
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
                            isLiving = efuns.living.isAlive(frame.context, thisObject),
                            ctx = frame.context;

                        for (let i = 0; i < inv.length; i++) {
                            let item = inv[i];

                            //  Call init on all living items in the environment's inventory
                            if (efuns.living.isAlive(frame.context, item)) {
                                await ctx.withPlayerAsync(item, async () => await thisObject.initAsync(frame.branch()));
                            }
                            //  Call init on every object in the environment
                            if (isLiving) {
                                await ctx.withPlayerAsync(thisObject, async () => await item.initAsync(frame.branch()));
                            }
                        }
                        //  If this object is living, call init in the new environment
                        if (isLiving) {
                            await ctx.withPlayerAsync(thisObject, async () => await target.initAsync(frame.branch()));
                        }
                    }
                    return true;
                }
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Query the security system for an objects privs
     * @param {ExecutionContext} ecc The current callstack
     * @param {MUDObject} target
     */
    static async queryPrivs(ecc, target) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'queryPrivs', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            return await driver.securityManager.queryPrivs(target);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Load or reload an object.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} expr The path expression to load
     * @param {number} flags Additional flags to control the operation
     */
    static async reloadObjectAsync(ecc, expr, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'reloadObjectAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            return await driver.fileManager.loadObjectAsync(frame.branch(), driver.efuns.resolvePath(expr), args, 1);
        }
        finally {
            frame.pop();
        }
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
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} spec The object to find
     * @returns The matching object or false if nothing matches
     */
    static async resolveObject(ecc, spec) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'resolveObject', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let n = -1,
                tp = driver.efuns.thisPlayer(frame.context),
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

                if (!(env = ObjectHelper.resolveObject(frame.branch(), where)))
                    return false;
                if (id.length === 0)
                    return env.environment.instance;
            }
            switch (spec) {
                case 'here':
                    return driver.efuns.thisPlayer(frame.context).environment;
                case 'me':
                    return driver.efuns.thisPlayer(frame.context);
            }
            let m = /(?<id>[^#]+)#(?<index>\d+)/.exec(spec);
            if (m && m.length === 3) {
                if ((ob = await ObjectHelper.findObject(frame.branch(), spec)))
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
                    if ((ob = await ObjectHelper.loadObjectAsync(frame.branch(), spec)))
                        return ob.instance;
                    else
                        return false;

                case '%':
                    if ((ob = driver.efuns.living.findPlayer(frame.branch(), spec)))
                        return ob.instance;
                    else
                        return false;

                case '$':
                    if (ob) {
                        let obs = ob.inventory.filter(o => {
                            if (!driver.efuns.living.isAlive(frame.branch(), o))
                                return false;
                            else if (driver.efuns.living.isInteractive(frame.branch(), o))
                                return false;
                            else return o.id(spec);
                        });
                        return obs.length < n ? obs[n - 1] : false;
                    }
                    else {
                        if ((ob = driver.efuns.living.findLiving(frame.branch(), spec))) {
                            if (Array.isArray(ob)) {
                                let obs = ob.filter(o => !driver.efuns.living.isInteractive(frame.branch(), o));
                                return obs.length < n ? obs[n - 1] : false;
                            }
                            else
                                return driver.efuns.living.isInteractive(frame.branch(), ob) ? false : ob;
                        }
                        return false;
                    }

                default:
                    if (!env)
                        env = driver.efuns.thisPlayer(frame.context);
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
                        if ((ob = driver.efuns.present(frame.branch(), spec, env)))
                            return ob;
                        else if ((env = env.environment)) {
                            if ((ob = driver.efuns.present(frame.branch(), spec, env)))
                                return ob;
                        }
                        if ((ob = driver.efuns.living.findPlayer(frame.branch(), spec)))
                            return ob;
                        if ((ob = driver.efuns.living.findLiving(frame.branch(), spec)))
                            return ob;
                        if (!tp)
                            return false;
                        spec = driver.efuns.resolvePath(frame.branch(), tp.workingDirectory, spec);
                        if ((ob = await ObjectHelper.loadObjectAsync(frame.branch(), spec)))
                            return ob;
                        else
                            return false;
                    }
                    break;
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }
}

module.exports = ObjectHelper;