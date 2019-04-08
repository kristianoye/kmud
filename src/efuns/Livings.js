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
     * Makes the thisObject a wizard.
     * @param {boolean|string} [flag=true] Disables the player flag if set to false
     * @returns {boolean} True if the flag state changed.
     */
    static enableWizard(flag = false) {
        let ecc = driver.getExecution(),
            thisObject = ecc.thisObject,
            store = driver.storage.get(thisObject);

        if (store) {
            return (store.wizard = flag);
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

        return Array.isArray(result) && allowPartial === true ?
            result.map(s => unwrap(s.owner)) :
            !Array.isArray(result) && unwrap(result.owner);
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
     * Determine if an object is a living object.
     * @param {any} target
     */
    static isAlive(target) {
        let ob = unwrap(target);
        if (ob) {
            let store = driver.storage.get(ob);
            return !!store && store.living;
        }
        return false;
    }

    /**
     * Determines if an object is connected to an active client
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object has an active client
     */
    static isConnected(target) {
        let ob = typeof target === 'object' ? target : unwrap(target);
        if (ob) {
            let store = driver.storage.get(ob);
            return !!store && store.connected;
        }
        return false;
    }

    /**
     * Determines if an object is, or has been, connected as a live player
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object is interactive
     */
    static isInteractive(target) {
        let store = driver.storage.get(target);
        return !!store && store.interactive;
    }

    /**
     * Determines if an object is a player
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object is interactive
     */
    static isPlayer(target) {
        let store = driver.storage.get(target);
        return !!store && store.player;
    }

    /**
     * Determines if an object is a wizard
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object is interactive
     */
    static isWizard(target) {
        let store = driver.storage.get(target);
        return !!store && store.wizard;
    }

    /**
     * Returns a list of players on the MUD.  
     * @param {boolean} showAll If true then linkdead players are shown as well
     * @returns {MUDObject[]} The list of players.
     */
    static players(showAll = false) {
        return driver.playerObjects
            .toArray()
            .map(o => {
                if (showAll)
                    return typeof o.owner === 'object' ? o.owner : false;
                else if (o.connected)
                    return typeof o.owner === 'object' ? o.owner : false;
            })
            .filter(o => o !== false);
    }
}

module.exports = LivingsHelper;

