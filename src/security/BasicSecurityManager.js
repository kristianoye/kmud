/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * BasicSecurityManager routes all security requests through the master object
 * like an LP driver.  Does not provide granular control over permissions, but
 * some people might prefer that.
 */
const
    BaseSecurityManager = require('./BaseSecurityManager'),
    SecurityFlags = require('./SecurityFlags'),
    BasicFlags = Object.freeze({
        P_WRITELIKE:
            SecurityFlags.P_CHANGEPERMS
            | SecurityFlags.P_CREATEDIR
            | SecurityFlags.P_CREATEFILE
            | SecurityFlags.P_DELETE
            | SecurityFlags.P_DELETEDIR
            | SecurityFlags.P_TAKEOWNERSHIP
            | SecurityFlags.P_WRITE
            | SecurityFlags.P_WRITEMETADATA,
        P_READLIKE:
            SecurityFlags.P_DESTRUCTOBJECT
            | SecurityFlags.P_EXECUTE
            | SecurityFlags.P_LISTDIR
            | SecurityFlags.P_LOADOBJECT
            | SecurityFlags.P_READ
            | SecurityFlags.P_READMETADATA
            | SecurityFlags.P_READPERMS
            | SecurityFlags.P_VIEWSYSTEMFILES
    });

/**
 * Routes all security requests through MUD's master object
 */
class BasicSecurityManager extends BaseSecurityManager {
    /**
     * Perform basic security check
     * @param {FileSystemObject} fo
     * @param {number} flags
     * @returns {boolean}
     */
    async can(fo, flags) {
        if ((flags & BasicFlags.P_WRITELIKE) > 0)
            return this.validWriteFile(fo.fullPath);
        else if ((flags & BasicFlags.P_READLIKE) > 0)
            return this.validReadFile(fo.fullPath);
        else {
            console.log(`BasicSecurityManager.can() received unrecognized flag value: ${flags}`);
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
        return this.validWriteFile( expr);
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
     * Determine if the caller has permission to read a particular file.
     * @param {string} filename The file to read from
     * @returns {boolean} True if the operation can proceed.
     */
    async validReadFile(filename) {
        return await driver.getExecution()
            .guarded(async f => await driver.callApplyAsyc(driver.applyValidRead, filename, f.owner, f.method));
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
            .guarded(async f => await driver.callApplyAsyc(driver.applyValidWrite, filename, f.owner, f.method));
    }
}

module.exports = BasicSecurityManager;
