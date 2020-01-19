/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides granular file security.
 */

const
    P_NONE = 0,
    P_READ = 1 << 0,
    P_WRITE = 1 << 1,
    P_CREATE = 1 << 2,
    P_LOAD = 1 << 3,
    P_LIST = 1 << 4,
    P_CREATEDIRECTORY = 1 << 5,
    P_DELETEDIRECTORY = 1 << 6,
    P_CHANGEPERMS = 1 << 7,
    P_CHANGEOWNER = 1 << 8,
    P_HIDDEN = 1 << 9,
    P_SYSTEM = 1 << 10,
    P_INHERITS = 1 << 11;

class FileACL {
    constructor() {
    }

    /**
     * Get the parent ACL (if any) 
     */
    async getParent() {
    }

    /**
     * Does this ACL inherit from its parent?
     */
    get inherits() {
    }

    get owner() {
    }

    validCreate(filename) {
    }

    validCreateDirectory(filename) {
    }

    validDelete(filename) {
    }

    validLoadObject(filename) {
    }

    validRead(filename) {
    }

    validRemoveDirectory(filename) {
    }

    validWrite(filename) {
    }
}

module.exports = FileACL;
