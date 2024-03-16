
class SecurityHelper {
    /**
     * Add members to a security group
     * @param {string} id
     * @param {string[]} members
     * @returns {boolean} True on success
     */
    static async addGroupMembers(id, members) {
        let ecc = driver.getExecution(),
            group = driver.securityManager.getGroup(id),
            principles = [];

        for (const memberId of members) {
            let cred = driver.securityManager.getCredential(memberId);
            if (cred) principles.push(cred);
        }

        if (!group)
            throw new Error(`addGroupMembers(): ${id} is an invalid group identifier`);
        if (!principles.length)
            throw new Error(`addGroupMembers(): No valid members provided`);

        if (await ecc.guarded(f => driver.callApplyAsync('validSecurityGroupChange', f.caller, 'addGroupMembers', group.createSafeExport()))) {
            return await driver.securityManager.addGroupMembers(group, principles);
        }
        throw new Error(`addGroupMembers(): Permission denied`);
    }

    static async createSecurityGroup(id, name, description) {
        let ecc = driver.getExecution(),
            group = typeof id === 'object' ? id : { id, name, description };

        if (await ecc.guarded(f => driver.callApplyAsync('validSecurityGroupChange', f.caller, 'createSecurityGroup', group)))
        {
            return await driver.securityManager.createGroup(group);
        }
        throw new Error(`createSecurityGroup(): Permission denied`);
    }

    static async deleteSecurityGroup(id) {
        let ecc = driver.getExecution(),
            group = await SecurityHelper.getSecurityGroup(id);

        if (!group)
            throw new Error(`deleteSecurityGroup(): Group ${id} does not exist`);

        if (await ecc.guarded(f => driver.callApplyAsync('validSecurityGroupChange', f.caller, 'deleteSecurityGroup', group))) {
            return await driver.securityManager.deleteGroup(group);
        }

        throw new Error(`deleteSecurityGroup(${id}): Permission denied`);
    }

    /**
     * Get the security credential for the specified target.
     * @param {string | MUDObject | MUDWrapper} target
     */
    static getCredentialAsync(target, reload) {
        if (typeof target === 'function' || typeof target === 'object') {
            target = target.instance;
        }
        return driver.securityManager.getSafeCredentialAsync(target);
    }

    /**
     * Fetch an export-friendly group object
     * @param {string} id The group to fetch
     * @returns {{ id: string, description:string, name: string, members: string[] }}
     */
    static getSecurityGroup(id) {
        let group = driver.securityManager.getGroup(id);
        return group && group.createSafeExport();
    }

    static async getSafeCredentialAsync(user, reload = false) {
        if (typeof user === 'function' && user.isWrapper)
            user = user.filename;
        else if (typeof user === 'object' && user.keyId)
            user = user.filename;

        if (typeof user !== 'string' || user.length === 0)
            return false;

        if (user.indexOf('/') === -1) {
            let [username, isPlayerName] = efuns.normalizeName(user, true),
                playerFiles = await driver.efuns.living[isPlayerName ? 'playerExists' : 'userExists'](username, true);

            if (playerFiles.length > 0) {
                user = playerFiles[0].fullPath;
            }
        }
        return await driver.securityManager.getSafeCredentialAsync(user, reload === true);
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

    static listSecurityGroups(expr) {
        return driver.securityManager.listGroups(expr);
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

    /**
     * Remove members from a security group
     * @param {string} id
     * @param {string[]} members
     * @returns {boolean} True on success
     */
    static async removeGroupMembers(id, members) {
        let ecc = driver.getExecution(),
            group = driver.securityManager.getGroup(id),
            principles = [];

        for (const memberId of members) {
            let cred = driver.securityManager.getCredential(memberId);
            if (cred) principles.push(cred);
        }

        if (!group)
            throw new Error(`removeGroupMembers(): ${id} is an invalid group identifier`);
        if (!principles.length)
            throw new Error(`removeGroupMembers(): No valid members provided`);

        if (await ecc.guarded(f => driver.callApplyAsync('validSecurityGroupChange', f.caller, 'removeGroupMembers', group.createSafeExport()))) {
            return await driver.securityManager.removeGroupMembers(group, principles);
        }
        throw new Error(`removeGroupMembers(): Permission denied`);
    }

    static get securityManagerType() {
        return driver.securityManager.constructor.name;
    }

    static async unguardedAsync(callback) {
        let thisObject = driver.efuns.thisObject();
        return driver.driverCallAsync('unguarded', callback, thisObject.filename || '[not specified]', true, true);
    }
}

module.exports = SecurityHelper;