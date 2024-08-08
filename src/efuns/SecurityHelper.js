const { ExecutionContext, CallOrigin, ExecutionFrame } = require("../ExecutionContext");

class SecurityHelper {
    /**
     * Add members to a security group
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} idIn
     * @param {string[]} membersIn
     * @returns {boolean} True on success
     */
    static async addGroupMembers(ecc, idIn, membersIn) {
        let [frame, id, members] = ExecutionContext.tryPushFrame(arguments, { method: 'addGroupMembers', file: __filename, isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let group = driver.securityManager.getGroup(id),
                principles = [];

            for (const memberId of members) {
                let cred = driver.securityManager.getCredential(frame.context, memberId);
                if (cred) principles.push(cred);
            }

            if (!group)
                throw new Error(`addGroupMembers(): ${id} is an invalid group identifier`);
            if (!principles.length)
                throw new Error(`addGroupMembers(): No valid members provided`);

            if (await ecc.guarded(f => driver.callApplyAsync(frame.branch(), 'validSecurityGroupChange', f.caller, 'addGroupMembers', group.createSafeExport()))) {
                return await driver.securityManager.addGroupMembers(group, principles);
            }
            throw new Error(`addGroupMembers(): Permission denied`);
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Create a security group
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} idIn
     * @param {string} nameIn
     * @param {string} descriptionIn
     * @returns
     */
    static async createSecurityGroup(ecc, idIn, nameIn, descriptionIn) {
        let [frame, id, name, description] = ExecutionContext.tryPushFrame(arguments, { method: 'createSecurityGroup', file: __filename, isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let ecc = frame.context,
                group = typeof id === 'object' ? id : { id, name, description };

            if (await ecc.guarded(f => driver.callApplyAsync(frame.branch(), 'validSecurityGroupChange', f.caller, 'createSecurityGroup', group))) {
                return await driver.securityManager.createGroup(group);
            }
            throw new Error(`createSecurityGroup(): Permission denied`);
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Delete a security group
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} idIn
     * @returns {Promise<boolean>}
     */
    static async deleteSecurityGroup(ecc, idIn) {
        let [frame, id] = ExecutionContext.tryPushFrame(arguments, { method: 'deleteSecurityGroup', file: __filename, isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let ecc = frame.context,
                group = await SecurityHelper.getSecurityGroup(id);

            if (!group)
                throw new Error(`deleteSecurityGroup(): Group ${id} does not exist`);

            if (await ecc.guarded(f => driver.callApplyAsync(frame.branch(), 'validSecurityGroupChange', f.caller, 'deleteSecurityGroup', group))) {
                return await driver.securityManager.deleteGroup(group);
            }

            throw new Error(`deleteSecurityGroup(${id}): Permission denied`);
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Get the security credential for the specified target.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string | MUDObject | MUDWrapper} targetIn
     */
    static getCredentialAsync(ecc, targetIn, reloadIn = false) {
        /**
         * @type {[ExecutionContext, string, boolean]}
         */
        let [frame, target, reload] = ExecutionContext.tryPushFrame(arguments, { method: 'getCredentialAsync', file: __filename, isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            if (typeof target === 'function' || typeof target === 'object') {
                target = target.instance;
            }
            return driver.securityManager.getSafeCredentialAsync(target);
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Fetch an export-friendly group object
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} idIn The group to fetch
     * @returns {{ id: string, description:string, name: string, members: string[] }}
     */
    static getSecurityGroup(ecc, idIn) {
        /**
         * @type {[ExecutionContext, string]}
         */
        let [frame, id] = ExecutionContext.tryPushFrame(arguments, { method: 'getSecurityGroup', file: __filename, isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            let group = driver.securityManager.getGroup(id);
            return group && group.createSafeExport();
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Get a credential object that is safe for the MUDlib
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} userIn
     * @param {any} reloadIn
     * @returns
     */
    static async getSafeCredentialAsync(ecc, userIn, reloadIn = false) {
        /**
         * @type {[ExecutionContext, string, boolean]}
         */
        let [frame, user, reload] = ExecutionContext.tryPushFrame(arguments, { method: 'getSafeCredentialAsync', file: __filename, isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            if (typeof user === 'function' && user.isWrapper)
                user = user.filename;
            else if (typeof user === 'object' && user.keyId)
                user = user.filename;

            if (typeof user !== 'string' || user.length === 0)
                return false;

            if (user.indexOf('/') === -1) {
                let [username, isPlayerName] = efuns.normalizeName(frame?.branch(), user, true),
                    playerFiles = await driver.efuns.living[isPlayerName ? 'playerExists' : 'userExists'](username, true);

                if (playerFiles.length > 0) {
                    user = playerFiles[0].fullPath;
                }
            }
            return await driver.securityManager.getSafeCredentialAsync(user, reload === true);
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Check to see if the specified user is in a particular group
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} username
     * @param {string} groupName
     */
    static isGroupMember(ecc, username, groupName) {
        let frame = ecc.push({ method: 'isGroupMember', file: __filename, isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            return driver.securityManager.isGroupMember(frame.context, username, groupName);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Get a list of defined security groups
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} expr A filter expression
     * @returns
     */
    static listSecurityGroups(ecc, expr) {
        let frame = ecc.push({ method: 'listSecurityGroups', file: __filename, isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            return driver.securityManager.listGroups(frame.context, expr);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Converts a permission string into a bitflag collection
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} exprIn The human-readable permission string
     * @returns {number} The bitflag array
     */
    static parsePerms(ecc, exprIn) {
        let frame = ecc.push({ method: 'parsePerms', file: __filename, isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            return driver.securityManager.parsePerms(frame.context, expr);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Convert a permission set into a human readable string
     * @param {ExecutionContext} ecc The current callstack
     * @param {number} flagsIn
     */
    static permsToString(ecc, flagsIn) {
        let [frame, flags] = ExecutionContext.tryPushFrame(arguments, { method: 'permsToString', file: __filename, isAsync: false, callType: CallOrigin.DriverEfun });
        try {
            return driver.securityManager.toPermString(flags);
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Remove members from a security group
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} idIn
     * @param {string[]} membersIn
     * @returns {boolean} True on success
     */
    static async removeGroupMembers(ecc, idIn, membersIn) {
        let [frame, id, members] = ExecutionContext.tryPushFrame(arguments, { method: '', file: __filename, isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let ecc = frame.context,
                group = driver.securityManager.getGroup(id),
                principles = [];

            for (const memberId of members) {
                let cred = driver.securityManager.getCredential(ecc, memberId);
                if (cred) principles.push(cred);
            }

            if (!group)
                throw new Error(`removeGroupMembers(): ${id} is an invalid group identifier`);
            if (!principles.length)
                throw new Error(`removeGroupMembers(): No valid members provided`);

            if (await ecc.guarded(f => driver.callApplyAsync(frame?.branch(), 'validSecurityGroupChange', f.caller, 'removeGroupMembers', group.createSafeExport()))) {
                return await driver.securityManager.removeGroupMembers(group, principles);
            }
            throw new Error(`removeGroupMembers(): Permission denied`);
        }
        finally {
            frame?.pop();
        }
    }

    static get securityManagerType() {
        return driver.securityManager.constructor.name;
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {function():boolean} callbackIn
     * @returns
     */
    static async unguardedAsync(ecc, callbackIn) {
        let [frame, callback] = ExecutionContext.tryPushFrame(arguments, { method: 'unguardedAsync', file: __filename, isAsync: true, callType: CallOrigin.DriverEfun, unguarded: true });
        try {
            let thisObject = ecc.thisObject;
            return driver.driverCallAsync('unguarded', callback, thisObject.filename || '[not specified]', true, true);
        }
        finally {
            frame?.pop();
        }
    }
}

module.exports = SecurityHelper;