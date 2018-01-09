/// <reference path="../dts/GameServer.d.ts"/>
/// <reference path="../dts/EFUNProxy.d.ts"/>
const
    FileSecurity = require('../FileSecurity'),
    { SecurityError } = require('../ErrorTypes');

class DefaultFileSecurity extends FileSecurity {
    /**
     * Generate a security error or just indicate failure quietly.
     * @param {any} verb The verb being denied (e.g. read, write, append, etc).
     * @param {function=} callback An optional callback 
     * @returns {false}
     */
    denied(verb, expr, callback) {
        if (this.throwSecurityExceptions)
            throw new SecurityError(`Permission denied: Could not ${verb} '${expr}'`);
        return typeof callback === 'function' ? callback(false, `Permission denied: Could not ${verb} '${expr}'`) : false;
    }

    /**
     * Determine whether the caller is allowed to create a directory.
     * @param {EFUNProxy} efuns The object attempting to create a directory.
     * @param {string} mudpath The directory being created.
     */
    validCreateDirectory(efuns, mudpath) {
        return this.validWriteFile(efuns, mudpath);
    }

    /**
     * Default security does not distinguish creating a file from writing.
     * @param {any} efuns
     * @param {string} expr
     */
    validCreateFile(efuns, expr) {
        return this.validWrite(efuns, expr);
    }

    /**
     * Default security does not distinguish deleting a file from writing.
     * @param {any} caller
     * @param {string} expr
     */
    validDeleteFile(caller, expr) {
        return this.validWrite(caller, expr);
    }

    /**
     * Default security does not restrict object destruction.
     * @param {any} caller
     * @param {any} expr
     */
    validDestruct(caller, expr) {
        return true;
    }

    /**
     * Default security system does not support granting permissions.
     */
    validGrant(caller, expr) {
        throw new Error('Security system does not support the use of grant');
    }

    /**
     * Default security does not enforce object loading or cloning.
     * @param {EFUNProxy} efuns External functions making the call.
     * @param {string} expr The path to load the object from.
     */
    validLoadObject(efuns, expr) {
        return this.validReadFile(efuns, expr);
    }

    /**
     * Default security does not distinguish between file and directory reads.
     * @param {EFUNProxy} efuns The proxy requesting the directory listing.
     * @param {string} expr The path expression to try and read.
     */
    validReadDirectory(efuns, expr) {
        return this.validReadFile(efuns, expr);
    }

    /**
     * Determine if the caller has permission to read a particular file.
     * @param {EFUNProxy} efuns
     * @param {string} expr
     */
    validReadFile(efuns, expr) {
        return true;
    }

    /**
     * Default security treats filestat as a normal read operation.
     * @param {EFUNProxy} efuns
     * @param {string} expr
     */
    validStatFile(efuns, expr) {
        return this.validReadFile(efuns, expr);
    }

    /**
     * Determine if the caller has permission to write to the filesystem.
     * @param {EFUNProxy} efuns
     * @param {string} expr
     */
    validWriteFile(efuns, expr) {
        return true;
    }
}

module.exports = DefaultFileSecurity;
