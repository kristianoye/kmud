/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: January 20, 2020
 *
 * Helper methods for array stuff
 */

const { NotImplementedError } = require("../ErrorTypes");

class AclHelper {
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

}

module.exports = Object.freeze(AclHelper);
