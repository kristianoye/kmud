/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
/// <reference path="../dts/GameServer.d.ts"/>
/// <reference path="../dts/EFUNProxy.d.ts"/>
const
    FileSecurity = require('../FileSecurity'),
    { SecurityError } = require('../ErrorTypes');

class DefaultFileSecurity extends FileSecurity {
    /**
     * Check to see if a directory exists.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     * @param {function(boolean,Error):void} callback
     */
    isDirectory(efuns, req, callback) {
        return this.validReadDirectory(efuns, req) ?
            this.fileSystem.isDirectory(req, callback) :
            this.denied('isDirectory', req.fullPath);
    }

    /**
     * Check to see if a directory exists.
     * @param {any} efuns
     * @param {any} req
     * @param {any} callback
     */
    isFile(efuns, req, callback) {
        return this.validReadFile(efuns, req) ?
            this.fileSystem.isFile(req, callback) :
            this.denied('isFile', req.fullPath);
    }

    /**
     * Attempt to read a directory.
     * @param {EFUNProxy} efuns The object requesting the operation.
     * @param {FileSystemRequest} req The filesystem request.
     * @param {function} [callback] A callback for non-Promise style async.
     */
    readDirectoryAsync(efuns, req, callback) {
        return this.validReadDirectory(efuns, req) ?
            this.fileSystem.readDirectoryAsync(req, callback) :
            this.denied('readDirectoryAsync', req.fullPath, callback);
    }

    /**
     * 
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     * @param {function(string,Error):void} callback
     */
    readFile(efuns, req, callback) {
        return this.validReadFile(efuns, req) ?
            this.fileSystem.readFile(req, callback) :
            this.denied('read', expr);
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
     * @param {EFUNProxy} efuns The object attempting to create a directory.
     * @param {FileSystemRequest} req The directory being created.
     */
    validCreateDirectory(efuns, req) {
        return this.validWriteFile(efuns, req);
    }

    /**
     * Default security does not distinguish creating a file from writing.
     * @param {any} efuns
     * @param {FileSystemRequest} req
     */
    validCreateFile(efuns, req) {
        return this.validWriteFile(efuns, expr);
    }

    /**
     * Determine if the caller is permitted to remove a particular directory.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validDeleteDirectory(efuns, req) {
        return this.validWriteFile(efuns, req);
    }

    /**
     * Default security does not distinguish deleting a file from writing.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validDeleteFile(efuns, req) {
        return this.validWriteFile(efuns, expr);
    }

    /**
     * Default security does not restrict object destruction.
     * @param {any} efuns
     * @param {FileSystemRequest} expr
     */
    validDestruct(efuns, expr) {
        return true;
    }

    /**
     * Default security system does not support granting permissions.
     */
    validGrant(efuns, expr) {
        throw new Error('Security system does not support the use of grant');
    }

    /**
     * Default security does not enforce object loading or cloning.
     * @param {EFUNProxy} efuns External functions making the call.
     * @param {FileSystemRequest} req The path to load the object from.
     */
    validLoadObject(efuns, req) {
        return this.validReadFile(efuns, req);
    }

    /**
     * Default security does not distinguish between file and directory reads.
     * @param {EFUNProxy} efuns The proxy requesting the directory listing.
     * @param {FileSystemRequest} req The path expression to try and read.
     */
    validReadDirectory(efuns, req) {
        return this.validReadFile(efuns, req);
    }

    /**
     * Determine if the caller has permission to read a particular file.
     * @param {EFUNProxy} efuns The object attempting to perform the read.
     * @param {string} filename The file to read from
     * @returns {boolean} True if the operation can proceed.
     */
    validReadFile(efuns, filename) {
        return driver.getExecution().guarded(f => driver.validRead(efuns, f, filename));
    }

    /**
     * Default security treats filestat as a normal read operation.
     * @param {EFUNProxy} efuns The object requesting the stat.
     * @param {string} filename The name of the file to stat
     * @returns {boolean} True if the operation can proceed.
     */
    validStatFile(efuns, filename) {
        return this.validReadFile(efuns, filename);
    }

    /**
     * Determine if the caller has permission to write to the filesystem.
     * @param {EFUNProxy} efuns The object making the write request.
     * @param {string} expr The path to write to
     * @returns {boolean} Returns true if the operation is permitted.
     */
    validWriteFile(efuns, expr) {
        return driver.getExecution()
            .guarded(f => driver.validWrite(efuns, f, expr));
    }
}

module.exports = DefaultFileSecurity;
