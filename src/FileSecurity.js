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

    validDeleteFile(expr) {
        throw new NotImplementedError('validDelete');
    }

    validDeleteDirectory(expr) {
        throw new NotImplementedError('validDeleteDirectory');
    }

    validDestruct(expr) {
        throw new NotImplementedError('validDestruct');
    }

    validGrant(expr) {
        throw new NotImplementedError('validGrant');
    }

    validListDirectory(expr) {
        throw new NotImplementedError('validListDirectory');
    }

    /**
     * Default security does not enforce object loading or cloning.
     * @param {EFUNProxy} caller External functions making the call.
     * @param {string} expr The path to load the object from.
     * @returns {boolean}
     */
    validLoadObject(caller, expr) {
        throw new NotImplementedError('validLoadFile');
    }

    validReadDirectory(expr) {
        throw new NotImplementedError('validReadDir');
    }

    validReadFile(expr) {
        throw new NotImplementedError('validRead');
    }

    validReadPermissions(expr) {
        throw new NotImplementedError('validReadPermissions');
    }

    /**
     * Validate the request to stat a file.
     * @param {string} expr The file expression to stat.
     * @param {number=} flags Optional detail flags
     * @returns {boolean} True if the caller has permission to perform the operation.
     */
    validStatFile(expr, flags) {
        throw new NotImplementedError('validStatFile');
    }

    /**
     * Validate a write operation.
     * @param {any} caller The caller attempting to write.
     * @param {string} expr The file expression to try and write to.
     */
    validWrite(expr) {
        throw new NotImplementedError('validWrite');
    }

    // #endregion
}

module.exports = FileSecurity;
