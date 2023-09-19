
class SecurityHelper {
    /**
     * Get the security credential for the specified target.
     * @param {string | MUDObject | MUDWrapper} target
     */
    static getCredentialAsync(target) {
        if (typeof target === 'function' || typeof target === 'object') {
            target = driver.efuns.unwrap(target);
        }
        return driver.securityManager.getSafeCredentialAsync(target);
    }

    /**
     * Loop through a gatekeeper method for each frame on the stack to
     * ensure all objects are permitted to perform the specified action.
     * 
     * @param {any} callback
     * @param {any} action
     * @param {any} rethrow
     */
    static async guardedAsync(callback, action = false, rethrow = false) {
        let promise = new Promise(async (resolve, reject) => {
            let ecc = driver.getExecution(driver, 'guarded', '', true, 0);
            try {
                let isAsync = driver.efuns.isAsync(callback);
                for (let i = 0, max = ecc.length, c = {}; i < max; i++) {
                    let frame = ecc.getFrame(i);
                    if (!frame.object && !frame.file)
                        continue; // Does this ever happen?
                    else if (frame.object === driver)
                        continue; // The driver always succeeds
                    else if (frame.object === driver.masterObject)
                        return true; // The master object always succeeds as well
                    else if (c[frame.file])
                        continue;
                    else if (isAsync && (c[frame.file] = await callback(frame.object || frame.file)) === false)
                        return false;
                    else if ((c[frame.file] = callback(frame.object || frame.file)) === false)
                        return false;
                    if (frame.unguarded === true)
                        break;
                }
            }
            catch (err) {
                if (rethrow) reject(err);
                else resolve(false);
            }
            finally {
                ecc.pop('guarded');
            }
        });

        if (typeof action === 'function') {
            promise.then(action)
        }

        return promise;
    }

    /**
     * Check to see if the specified user is in a particular group
     * @param {string} username
     * @param {string} groupName
     */
    static isGroupMember(username, groupName) {
        return driver.securityManager.isGroupMember(username, groupName);
    }

    static parseAclTree(data) {
        throw new NotImplementedError('parseAclTree');
    }

    /**
     * Converts a permission string into a bitflag collection
     * @param {string} expr The human-readable permission string
     * @returns {number} The bitflag array
     */
    static parsePerms(expr) {
        throw new NotImplementedError('parsePerms');
    }
    
    /**
     * Convert a permission set into a human readable string
     * @param {number} flags
     */
    static permsToString(flags) {
        throw new NotImplementedError('permsToString');
    }

    static async unguardedAsync(callback) {
        let thisObject = driver.efuns.thisObject();
        return driver.driverCallAsync('unguarded', callback, thisObject.filename || '[not specified]', true, true);
    }
}

module.exports = SecurityHelper;