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
     * Makes the thisObject a wizard.
     * @param {boolean} [flag=true] Disables the player flag if set to false
     * @returns {boolean} True if the flag state changed.
     */
    static enablePlayer(flag = true) {
        let ecc = driver.getExecution(),
            thisObject = ecc.thisObject,
            store = driver.storage.get(thisObject);

        if (store) {
            return (store.player = flag);
        }
        return false;
    }
}

module.exports = LivingsHelper;

