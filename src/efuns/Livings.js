/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 16, 2019
 * 
 * Helper methods for "living" objects.
 */

class LivingsHelper {
    /**
     * Makes the thisObject have a heartbeat.
     * @param {boolean} [flag=true] Disables the heartbeats flag if set to false
     * @returns {boolean} True if the flag state changed.
     */
    static enableHeartbeat(flag = true) {
        let ecc = driver.getExecution(),
            thisObject = ecc.thisObject,
            store = driver.storage.get(thisObject);

        if (store) {
            return (store.heartbeat = flag);
        }
        return false;
    }

    /**
     * Makes the thisObject a living being.
     * @param {boolean|string} [flag=true] Disables the player flag if set to false
     * @returns {boolean} True if the flag state changed.
     */
    static enableLiving(flag = false) {
        let ecc = driver.getExecution(),
            thisObject = ecc.thisObject,
            store = driver.storage.get(thisObject);

        if (store) {
            return (store.living = flag);
        }
        return false;
    }

    /**
     * Makes the thisObject a player.
     * @param {boolean|string} [flag=true] Disables the player flag if set to false
     * @returns {boolean} True if the flag state changed.
     */
    static enablePlayer(flag = false) {
        let ecc = driver.getExecution(),
            thisObject = ecc.thisObject,
            store = driver.storage.get(thisObject);

        if (store) {
            return (store.player = flag);
        }
        return false;
    }

    /**
     * Attempt to find a living object by name
     * @param {any} name
     * @param {any} allowPartial
     */
    static findLiving(name, allowPartial = false) {
        let result = driver.livingObjects
            .find(efuns.normalizeName(name), allowPartial);

        return Array.isArray(result) ?
            result.map(s => unwrap(s.owner)) :
            unwrap(result);
    }

    /**
     * Attempt to find a player object by name
     * @param {any} name
     * @param {any} allowPartial
     */
    static findPlayer(name, allowPartial = false) {
        let result = driver.playerObjects
            .find(efuns.normalizeName(name), allowPartial);

        return Array.isArray(result) ?
            result.map(s => unwrap(s.owner)) :
            unwrap(result);
    }

    /**
     * Determines if an object has a heartbeat
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object has a periodic heartbeat.
     */
    static hasHeartbeat(target) {
        let ob = unwrap(target);
        if (ob) {
            let store = driver.storage.get(ob);
            return !!store && store.heartbeat;
        }
        return false;
    }

    /**
     * Determines if an object is connected to an active client
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object has an active client
     */
    static isConnected(target) {
        let ob = unwrap(target);
        if (ob) {
            let store = driver.storage.get(ob);
            return !!store && store.interactive;
        }
        return false;
    }

    /**
     * Determines if an object is, or has been, connected as a live player
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object is interactive
     */
    static isInteractive(target) {
        let ob = unwrap(target);
        if (ob) {
            let store = driver.storage.get(ob);
            return !!store && store.interactive;
        }
        return false;
    }
}

module.exports = LivingsHelper;

