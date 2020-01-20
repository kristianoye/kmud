/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: January 20, 2020
 *
 * Helper methods for array stuff
 */
const
    FileACL = require('../fs/FileACL');


class AclHelper {
    static parseAclTree(data) {
        return FileACL.parseAclTree(data);
    }

    /**
     * Converts a permission string into a bitflag collection
     * @param {string} expr The human-readable permission string
     * @returns {number} The bitflag array
     */
    static parsePerms(expr) {
        return FileACL.parsePerms(expr);
    }

    /**
     * Convert a permission set into a human readable string
     * @param {number} flags
     */
    static permsToString(flags) {
        return FileACL.permsToString(flags);
    }

}

module.exports = Object.freeze(AclHelper);
