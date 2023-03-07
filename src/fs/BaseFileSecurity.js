/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDEventEmitter = require('../MUDEventEmitter'),
    { NotImplementedError, SecurityError } = require('../ErrorTypes');

class BaseFileSecurity extends MUDEventEmitter {
    /**
     * Construct a file security model that acts as a firewall
     * between mudlib and filesystem.
     * @param {FileManager} fileManager A reference to the file manager.
     * @param {Object.<string,any>} options
     */
    constructor(fileManager, options) {
        super();

        /**
         * The name of the method to call in the master object when bootstrapping
         * the security manager.
         * @type {string} */
        this.bootstrapApply = options.bootstrapApply;

        /** @type {GameServer} */
        this.driver = fileManager.driver;

        /** @type {FileManager} */
        this.fileManager = fileManager;

        /** @type  {Object.<string,any>} */
        this.options = options || {};

        /** @type {boolean} */
        this.throwSecurityExceptions = this.options.throwSecurityExceptions || false;
    }

    async bootstrap(masterObject) {
        if (this.bootstrapApply) {
            if (typeof masterObject[this.bootstrapApply] !== 'function') {
                throw new Error(`BaseFileSecurity.bootstrap(): Failed to locate apply '${this.bootstrapApply}' in master object '${masterObject.filename}'`);
            }
            return masterObject[this.bootstrapApply]();
        }
    }

    async can(flags) {
        throw new NotImplementedError('Method can() is not defined');
    }

    /**
     * Generate a security error or just indicate failure quietly.
     * @param {string} verb The verb being denied (e.g. read, write, append, etc).
     * @param {FileSystemRequest} req The request being made.
     * @param {function(boolean,Error):void} callback An optional callback 
     * @returns {false} This always returns false
     */
    denied(verb, req, callback) {
        let err = undefined;
        if (typeof verb === 'object') {
            req = verb;
            err = new SecurityError(`Permission denied: Could not ${req.op} '${req.fullPath}'`);
        }
        else
            err = new SecurityError(`Permission denied: Could not ${verb} '${(req.fullPath || req)}'`);

        if (this.throwSecurityExceptions)
            throw err;

        return typeof callback === 'function' ?
            callback(false, err) :
            false;
    }

    isSystemFile(path) {
        return false;
    }

    // #region Security valid* Applies

    /**
     * Check to see if the caller may append to file.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validAppendFile(efuns, req) {
        throw new NotImplementedError('validAppendFile');
    }


    /**
     * Check to see if the caller may create a directory.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validCreateDirectory(efuns, req) {
        throw new NotImplementedError('validCreateDirectory');
    }

    /**
     *
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validCreateFile(efuns, req) {
        throw new NotImplementedError('validCreateFile');
    }

    /**
     *
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validDeleteFile(efuns, req) {
        throw new NotImplementedError('validDelete');
    }

    /**
     *
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validDeleteDirectory(efuns, req) {
        throw new NotImplementedError('validDeleteDirectory');
    }

    /**
     *
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validDestruct(efuns, req) {
        throw new NotImplementedError('validDestruct');
    }

    /**
     * Does the caller have the ability to modify permissions.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {FileSystemRequest} req The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
    */
    validGrant(efuns, req) {
        throw new NotImplementedError('validGrant');
    }

    /**
     * Default security does not enforce object loading or cloning.
     * @param {EFUNProxy} efuns External functions making the call.
     * @param {FileSystemRequest} req The path to load the object from.
     * @returns {boolean}
     */
    validLoadObject(efuns, req) {
        throw new NotImplementedError('validLoadFile');
    }

    /**
     * Does the caller have permissions to read a directory.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {FileSystemRequest} req The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
    */
    validReadDirectory(efuns, req) {
        throw new NotImplementedError('validReadDir');
    }

    /**
     * Does the caller have permission to read a file.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {FileSystemRequest} req The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
    */
    validReadFile(efuns, req) {
        throw new NotImplementedError('validRead');
    }

    /**
     * Does the caller have permission to read file permissions.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {FileSystemRequest} req The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
    */
    validReadPermissions(efuns, req) {
        throw new NotImplementedError('validReadPermissions');
    }

    /**
     * Validate the request to stat a file.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {FileSystemRequest} req The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
     */
    validStatFile(efuns, req) {
        throw new NotImplementedError('validStatFile');
    }

    /**
     * Validate a write operation.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {FileSystemRequest} req The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
     */
    validWriteFile(efuns, req) {
        throw new NotImplementedError('validWrite');
    }

    // #endregion
}

module.exports = BaseFileSecurity;
