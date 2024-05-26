const MUDStorageFlags = require('../MUDStorageFlags');

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
    static enableLiving(flag = true) {
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
     * @param {string} name
     * @param {boolean} allowPartial
     */
    static findLiving(name, allowPartial = false) {
        let result = driver.livingObjects
            .find(efuns.normalizeName(name), allowPartial);

        return Array.isArray(result) ?
            result.map(s => s.owner.instance) :
            result && result.owner && result.owner.instance;
    }

    /**
     * Attempt to find a player object by name
     * @param {string} name
     * @param {boolean} allowPartial
     */
    static findPlayer(name, allowPartial = false) {
        let result = driver.playerObjects
            .find(efuns.normalizeName(name), allowPartial);

        return Array.isArray(result) ?
            result.map(s => s.owner.instance) :
            result && result.owner && result.owner.instance;
    }

    /**
     * Attempt to find a player object by name
     * @param {string} name
     * @param {boolean} allowPartial
     */
    static findWizard(name, allowPartial = false) {
        let result = driver.wizardObjects
            .find(efuns.normalizeName(name), allowPartial);

        return Array.isArray(result) ?
            result.map(s => s.owner.instance) :
            result && result.owner && result.owner.instance;
    }

    /**
     * Determines if an object has a heartbeat
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object has a periodic heartbeat.
     */
    static hasHeartbeat(target) {
        let ob = target.instance;
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
        let ob = target.instance;
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
        let ob = target.instance;
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
        let store = driver.storage.get(target.instance);
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

    static async playerExists(user, wantFile = false) {
        return await driver.callApplyAsync('applyUserExists', user, false, wantFile);
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

    /**
     * Check to see how long a particular user has been idle.
     * @param {MUDObject|MUDWrapper} target An interactive user object.
     * @returns {number} The amount of idle time in milliseconds.
     */
    static queryIdle(target) {
        return unwrap(target, ob => {
            let $storage = driver.storage.get(ob);
            if ($storage.flags & MUDStorageFlags.PROP_INTERACTIVE) {
                if ($storage.flags & MUDStorageFlags.PROP_CONNECTED) {
                    return $storage.idleTime;
                }
                return -1;
            }
            return 0;
        });
    }

    static setLivingName(name) {
        let previousObject = efuns.previousObject(),
            ob = previousObject.instance,
            store = driver.storage.get(ob);

        if (store)
            store.livingName = name;
    }

    /**
     * Determines if a user by the specified name exists on the MUD
     * @param {string} user
     * @returns True if the user exists either as a player or a wizard
     */
    static async userExists(user, wantFile = false) {
        return await driver.callApplyAsync('applyUserExists', user, undefined, wantFile);
    }

    static async wizardExists(user, wantFile = false) {
        return await driver.callApplyAsync('applyUserExists', user, true, wantFile);
    }
}

module.exports = LivingsHelper;

