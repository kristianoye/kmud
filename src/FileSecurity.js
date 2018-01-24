const
    MUDEventEmitter = require('./MUDEventEmitter'),
    { NotImplementedError } = require('./ErrorTypes'),
    GameServer = require('./GameServer');

class FileSecurity extends MUDEventEmitter {
    /**
     * Construct a file security model that acts as a firewall
     * between mudlib and filesystem.
     * @param {FileManager} fileManager A reference to the file manager.
     * @param {FileSystem} fileSystem A reference to the filesystem this object manages.
     * @param {Object.<string,any>} options
     */
    constructor(fileManager, fileSystem, options) {
        super();

        /** @type {GameServer} */
        this.driver = fileManager.driver;

        /** @type {FileManager} */
        this.fileManager = fileManager;

        /** @type {FileSystem} */
        this.fileSystem = fileSystem;

        /** @type  {Object.<string,any>} */
        this.options = options || {};

        /** @type {boolean} */
        this.throwSecurityExceptions = this.options.throwSecurityExceptions || false;

        fileSystem.addSecurityManager(this);
    }

    // #region FileSystem Implementation

    /**
     * Attempt to create a directory.
     * @param {EFUNProxy} efuns The efuns instance creating the directory.
     * @param {string} expr The path being created.
     * @param {function=} callback
     */
    createDirectory(efuns, expr, callback) {
        throw new NotImplementedError('createDirectory');
    }

    /**
     * Generate a security error or just indicate failure quietly.
     * @param {string} verb The verb being denied (e.g. read, write, append, etc).
     * @param {FileSystemRequest} req The request being made.
     * @param {function(boolean,Error):void} callback An optional callback 
     * @returns {false} This always returns false
     */
    denied(verb, req, callback) {
        if (this.throwSecurityExceptions)
            throw new SecurityError(`Permission denied: Could not ${verb} '${(req.fullPath || req)}'`);

        return typeof callback === 'function' ?
            callback(false, new Error(`Permission denied: Could not ${verb} '${(req.fullPath || req)}'`)) :
            false;
    }

    /**
     * Check to see if a directory exists.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     * @param {function(boolean,Error):void} callback
     */
    isDirectory(efuns, req, callback) {
        return this.validReadDirectory(efuns, req.pathFull) ?
            this.fileSystem.isDirectory(req.pathRel, callback) :
            this.denied('isDirectory', req.fullPath);
    }

    /**
     * Checks to see if the given expression is a file.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     * @param {function(boolean,Error):void} callback
     */
    isFile(efuns, req, callback) {
        throw new NotImplementedError('isFile');
    }

    /**
     * Loads an object from disk.
     * @param {EFUNProxy} efuns
     * @param {string} expr
     * @param {object=} args
     * @param {function=} callback
     */
    loadObject(efuns, expr, args, callback) {
        throw new NotImplementedError('loadObject');
    }

    /**
     * Attempt to read a directory.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     * @param {function=} callback
     */
    readDirectory(efuns, req, callback) {
        throw new NotImplementedError('readDirectory');
    }

    /**
     * Attempt to read a file.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     * @param {function=} callback
     */
    readFile(efuns, req, callback) {
        throw new NotImplementedError('readFile');
    }

    readJsonFile(efuns, expr, callback) {
        throw new NotImplementedError('readJsonFile');
    }

    /**
     * Writes a file to disk.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     * @param {Buffer|string} content
     * @param {function=} callback
     */
    writeFile(req, expr, content, callback) {
        throw new NotImplementedError('writeFile');
    }

    // #endregion

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
    validWrite(efuns, req) {
        throw new NotImplementedError('validWrite');
    }

    // #endregion
}

module.exports = FileSecurity;
