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
     * Attempt to read a file.
     * @param {EFUNProxy} efuns
     * @param {string} expr
     * @param {function=} callback
     */
    readFile(efuns, expr, callback) {
        throw new NotImplementedError('readFile');
    }

    readJsonFile(efuns, expr, callback) {
        throw new NotImplementedError('readJsonFile');
    }

    /**
     * Writes a file to disk.
     * @param {EFUNProxy} efuns
     * @param {string} expr
     * @param {Buffer|string} content
     * @param {function=} callback
     */
    writeFile(efuns, expr, content, callback) {
        throw new NotImplementedError('writeFile');
    }

    // #endregion

    // #region Security valid* Applies

    validCreateDirectory(expr) {
        throw new NotImplementedError('validCreateDirectory');
    }

    validCreateFile(expr) {
        throw new NotImplementedError('validCreateFile');
    }

    validDeleteFile(efuns, expr) {
        throw new NotImplementedError('validDelete');
    }

    validDeleteDirectory(efuns, expr) {
        throw new NotImplementedError('validDeleteDirectory');
    }

    validDestruct(efuns, expr) {
        throw new NotImplementedError('validDestruct');
    }

    /**
     * Does the caller have the ability to modify permissions.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {string} expr The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
    */
    validGrant(efuns, expr) {
        throw new NotImplementedError('validGrant');
    }

    /**
     * Default security does not enforce object loading or cloning.
     * @param {EFUNProxy} efuns External functions making the call.
     * @param {string} expr The path to load the object from.
     * @returns {boolean}
     */
    validLoadObject(efuns, expr) {
        throw new NotImplementedError('validLoadFile');
    }

    /**
     * Does the caller have permissions to read a directory.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {string} expr The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
    */
    validReadDirectory(efuns, expr) {
        throw new NotImplementedError('validReadDir');
    }

    /**
     * Does the caller have permission to read a file.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {string} expr The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
    */
    validReadFile(efuns, expr) {
        throw new NotImplementedError('validRead');
    }

    /**
     * Does the caller have permission to read file permissions.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {string} expr The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
    */
    validReadPermissions(efuns, expr) {
        throw new NotImplementedError('validReadPermissions');
    }

    /**
     * Validate the request to stat a file.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {string} expr The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
     */
    validStatFile(efuns, expr) {
        throw new NotImplementedError('validStatFile');
    }

    /**
     * Validate a write operation.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {string} expr The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
     */
    validWrite(efuns, expr) {
        throw new NotImplementedError('validWrite');
    }

    // #endregion
}

module.exports = FileSecurity;
