/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    { BaseSecurityManager } = require('./BaseSecurityManager');

class FilePermissions {
    constructor(stat, acl) {
        this.inherits = typeof acl.inherits === 'boolean' ? acl.inherits : true;
        this.owner = acl.owner;
        this.group = acl.group;
        this.ownerPermissions = acl.ownerPermissions;
        this.groupPermissions = acl.groupPermissions;
        this.otherPermissions = acl.otherPermissions;
        this.path = stat.path;
    }
}

/** Mimics UNIX-like file-based permissions */
class UnixSecurityManager extends BaseSecurityManager {
    constructor(fileManager, fileSystem, options) {
        super(fileManager, fileSystem, options);

        /** @type {Object.<string, FilePermissions>} */
        this.permsCache = {};
    }

    /**
     * Get the Access Control List for the specified object.
     * @param {FileSystemObject} stat The stat to get an Acl for
     */
    async getAcl(stat) {
        if (stat.isFile) {
            let parent = await stat.getParentAsync(),
                parentAcl = await this.getAcl(parent);
            return parentAcl;
        }
        else if (stat.isDirectory) {
            if (stat.path in this.permsCache)
                return this.permsCache[stat.path];

            let aclData = await driver.fileManager.getSystemFileAsync(stat.mapPath('.acl'), 1);
            if (!aclData.exists) {
                let parent = await stat.getParentAsync();
                if (parent) return await this.getAcl(parent);
            }
            let data = await aclData.readJsonAsync();
            return this.permsCache[stat.path] = new FilePermissions(aclData, data);
        }
    }

    /**
      * Check to see if the caller may append to file.
      * @param {EFUNProxy} efuns
      * @param {FileSystemRequest} req
      */
    validAppendFile(efuns, req) {
        return this.validWriteFile(efuns, req);
    }

    /**
     * Determine whether the caller is allowed to create a directory.
     * @param {string} expr The directory being created.
     */
    validCreateDirectory(expr) {
        return this.validWriteFile(expr);
    }

    /**
     * Default security does not distinguish creating a file from writing.
     * @param {string} expr The expression to create
     */
    validCreateFile(expr) {
        return this.validWriteFile(expr);
    }

    /**
     * Determine if the caller is permitted to remove a particular directory.
     * @param {string} expr The directory to delete
     */
    validDeleteDirectory(expr) {
        return this.validWriteFile(expr);
    }

    /**
     * Default security does not distinguish deleting a file from writing.
     * @param {string} expr The path to delete
     */
    validDeleteFile(expr) {
        return this.validWriteFile(expr);
    }

    /**
     * Default security does not restrict object destruction.
     * @param {FileSystemRequest} expr
     */
    validDestruct(expr) {
        return true;
    }

    /**
     * Determine if the user has access to the specified directory.
     * @param {any} expr
     */
    validGetDirectory(expr) {
        return true;
    }

    /**
     * Default security system does not support granting permissions.
     */
    validGrant(expr) {
        throw new Error('Security system does not support the use of grant');
    }

    /**
     * Default security does not enforce object loading or cloning.
     * @param {string} expr The path to load the object from.
     */
    validLoadObject(expr) {
        return this.validReadFile(expr);
    }

    /**
     * Default security does not distinguish between file and directory reads.
     * @param {EFUNProxy} efuns The proxy requesting the directory listing.
     * @param {FileSystemRequest} req The path expression to try and read.
     */
    async validReadDirectory(req) {
        return await this.validReadFile(req);
    }

    /**
     * Perform a security check
     * @param {DirectoryObject} stat The stat object to check
     */
    async validReadDirectoryAsync(stat) {
        let ecc = driver.getExecution(),
            acl = this.getAcl(stat);

        if (!stat.isDirectory)
            throw new Error(`Bad argument 1 to validReadDirectoryAsync; Expected DirectoryObject got ${stat.constructor.name}`);
        return true; // BOGUS... but does not work yet
    }

    /**
     * Determine if the caller has permission to read a particular file.
     * @param {string} filename The file to read from
     * @returns {boolean} True if the operation can proceed.
     */
    async validReadFile(filename) {
        return await driver.getExecution()
            .guarded(async f => await driver.validRead(f, filename));
    }

    /**
     * Default security treats filestat as a normal read operation.
     * @param {string} filename The name of the file to stat
     * @returns {boolean} True if the operation can proceed.
     */
    validStatFile(filename) {
        return this.validReadFile(filename);
    }

    /**
     * Determine if the caller has permission to write to the filesystem.
     * @param {string} expr The path to write to
     * @returns {boolean} Returns true if the operation is permitted.
     */
    validWriteFile(expr) {
        return driver.getExecution()
            .guarded(f => driver.validWrite(f, expr));
    }
}

module.exports = UnixSecurityManager;
