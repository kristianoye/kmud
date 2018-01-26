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
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     * @param {number} flags
     * @param {function(any[], Error):void} callback
     */
    readDirectory(efuns, req, callback) {
        return this.validReadDirectory(efuns, req) ?
            this.fileSystem.readDirectory(req, callback) :
            this.denied('readDirectory', req.fullPath, callback);
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
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validReadFile(efuns, req) {
        let ctx = driver.getContext();
        for (let i = 0; i < ctx.length; i++) {
            if (!driver.validRead(efuns, ctx.objectStack[i], req.fullPath)) {
                if (this.throwSecurityExceptions)
                    throw new SecurityError(`Permission Denied: Read: ${req.fullPath}`);
                return false;
            }
        }
        return true;
    }

    /**
     * Default security treats filestat as a normal read operation.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validStatFile(efuns, req) {
        return this.validReadFile(efuns, req);
    }

    /**
     * Determine if the caller has permission to write to the filesystem.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validWriteFile(efuns, req) {
        let ctx = driver.getContext();
        for (let i = 0; i < ctx.length; i++) {
            if (!driver.validWrite(efuns, ctx.objectStack[i], req.fullPath)) {
                if (this.throwSecurityExceptions)
                    throw new SecurityError(`Permission Denied: Read: ${req.fullPath}`);
                return false;
            }
        }
        return true;
    }
}

module.exports = DefaultFileSecurity;
