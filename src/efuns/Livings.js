const { ExecutionContext, CallOrigin } = require('../ExecutionContext');
const MUDStorageFlags = require('../MUDStorageFlags');

class LivingsHelper {
    /**
     * Makes the thisObject have a heartbeat.
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {boolean} [flag=true] Disables the heartbeats flag if set to false
     * @returns {boolean} True if the flag state changed.
     */
    static enableHeartbeat(ecc, flag = true) {
        let frame = ecc.push({ file: __filename, method: 'enableHeartbeat', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let thisObject = ecc.thisObject,
                store = driver.storage.get(thisObject);

            if (store) {
                return (store.heartbeat = flag);
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Makes the thisObject a living being.
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {boolean|string} [flag=true] Disables the player flag if set to false
     * @returns {boolean} True if the flag state changed.
     */
    static enableLiving(ecc, flag = true) {
        let frame = ecc.push({ file: __filename, method: 'enableLiving', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let thisObject = ecc.thisObject,
                store = driver.storage.get(thisObject);

            if (store) {
                return (store.living = flag);
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Makes the thisObject a player.
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {boolean|string} [flag=true] Disables the player flag if set to false
     * @returns {boolean} True if the flag state changed.
     */
    static enablePlayer(ecc, flag = false) {
        let frame = ecc.push({ file: __filename, method: 'enablePlayer', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let thisObject = ecc.thisObject,
                store = driver.storage.get(thisObject);

            if (store) {
                return (store.player = flag);
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Makes the thisObject a wizard.
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {boolean|string} [flag=true] Disables the player flag if set to false
     * @returns {boolean} True if the flag state changed.
     */
    static enableWizard(ecc, flag = false) {
        let frame = ecc.push({ file: __filename, method: 'enableWizard', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let thisObject = ecc.thisObject,
                store = driver.storage.get(thisObject);

            if (store) {
                return (store.wizard = flag);
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Attempt to find a living object by name
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {string} name
     * @param {boolean} allowPartial
     */
    static findLiving(ecc, name, allowPartial = false) {
        let frame = ecc.push({ file: __filename, method: 'findLiving', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let result = driver.livingObjects
                .find(efuns.normalizeName(name), allowPartial);

            return Array.isArray(result) ?
                result.map(s => s.owner.instance) :
                result && result.owner && result.owner.instance;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Attempt to find a player object by name
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {string} name
     * @param {boolean} allowPartial
     */
    static findPlayer(ecc, name, allowPartial = false) {
        let frame = ecc.push({ file: __filename, method: 'findPlayer', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let result = driver.playerObjects
                .find(efuns.normalizeName(frame.context, name), allowPartial);

            return Array.isArray(result) ?
                result.map(s => s.owner.instance) :
                result && result.owner && result.owner.instance;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Attempt to find a player object by name
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {string} name
     * @param {boolean} allowPartial
     */
    static findCreator(ecc, name, allowPartial = false) {
        let frame = ecc.push({ file: __filename, method: 'findCreator', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let result = driver.wizardObjects
                .find(efuns.normalizeName(frame.context, name), allowPartial);

            return Array.isArray(result) ?
                result.map(s => s.owner.instance) :
                result && result.owner && result.owner.instance;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determines if an object has a heartbeat
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object has a periodic heartbeat.
     */
    static hasHeartbeat(ecc, target) {
        let frame = ecc.push({ file: __filename, method: 'hasHeartbeat', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let ob = target.instance;
            if (ob) {
                let store = driver.storage.get(ob);
                return !!store && store.heartbeat;
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determine if an object is a living object.
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {any} target
     */
    static isAlive(ecc, target) {
        let frame = ecc.push({ file: __filename, method: 'isAlive', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let ob = target.instance;
            if (ob) {
                let store = driver.storage.get(ob);
                return !!store && store.living;
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determines if an object is connected to an active client
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object has an active client
     */
    static isConnected(ecc, target) {
        let frame = ecc.push({ file: __filename, method: 'isConnected', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let ob = target.instance;
            if (ob) {
                let store = driver.storage.get(ob);
                return !!store && store.connected;
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determines if an object is, or has been, connected as a live player
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object is interactive
     */
    static isInteractive(ecc, target) {
        let frame = ecc.push({ file: __filename, method: 'isInteractive', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let store = driver.storage.get(target.instance);
            return !!store && store.interactive;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determines if an object is a player
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object is interactive
     */
    static isPlayer(ecc, target) {
        let frame = ecc.push({ file: __filename, method: 'isPlayer', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let store = driver.storage.get(target);
            return !!store && store.player;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determines if an object is a wizard
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {MUDObject|MUDWrapper} target The item to check
     * @returns {boolean} Returns true if the object is interactive
     */
    static isWizard(ecc, target) {
        let frame = ecc.push({ file: __filename, method: 'isWizard', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let store = driver.storage.get(target);
            return !!store && store.wizard;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {any} user
     * @param {any} wantFile
     * @returns
     */
    static async playerExists(ecc, user, wantFile = false) {
        let frame = ecc.push({ file: __filename, method: 'playerExists', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            return await driver.callApplyAsync(frame.branch(), 'applyUserExists', user, false, wantFile);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Returns a list of players on the MUD.  
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {boolean} showAll If true then linkdead players are shown as well
     * @returns {MUDObject[]} The list of players.
     */
    static players(ecc, showAll = false) {
        let frame = ecc.push({ file: __filename, method: 'players', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let players = driver.playerObjects
                .toArray()
                .map(o => {
                    if (showAll)
                        return typeof o.owner === 'object' ? o.owner : false;
                    else if (o.connected)
                        return typeof o.owner === 'object' ? o.owner : false;
                })
                .filter(o => o !== false);
            return players;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Check to see how long a particular user has been idle.
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {MUDObject|MUDWrapper} target An interactive user object.
     * @returns {number} The amount of idle time in milliseconds.
     */
    static queryIdle(ecc, target) {
        let frame = ecc.push({ file: __filename, method: 'queryIdle', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let $storage = driver.storage.get(target);
            if ($storage && $storage.flags & MUDStorageFlags.PROP_INTERACTIVE) {
                if ($storage.flags & MUDStorageFlags.PROP_CONNECTED) {
                    return $storage.idleTime;
                }
                return -1;
            }
            return 0;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Set the living name of the current object
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {any} name
     */
    static setLivingName(ecc, name) {
        let frame = ecc.push({ file: __filename, method: 'setLivingName', isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let ob = ecc.thisObject,
                store = driver.storage.get(ob);

            if (store)
                store.livingName = name;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determines if a user by the specified name exists on the MUD
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {string} user
     * @returns True if the user exists either as a player or a wizard
     */
    static async userExists(ecc, user, wantFile = false) {
        let frame = ecc.push({ file: __filename, method: '', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            return await driver.callApplyAsync(frame.branch(), 'applyUserExists', user, undefined, wantFile);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Check to see if a creator exists
     * @param {ExecutionContext} ecc The current execution context/callstack
     * @param {any} user
     * @param {any} wantFile
     * @returns
     */
    static async creatorExists(ecc, user, wantFile = false) {
        let frame = ecc.push({ file: __filename, method: '', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            return await driver.callApplyAsync(frame.branch(), 'applyUserExists', user, true, wantFile);
        }
        finally {
            frame.pop();
        }
    }
}

module.exports = LivingsHelper;

