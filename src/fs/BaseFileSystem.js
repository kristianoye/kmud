const
    MUDEventEmitter = require('../MUDEventEmitter');

const
    FS_NONE = 0,            // No flags set
    FS_SYNC = 1 << 0,       // The filesystem supports syncronous I/O.
    FS_ASYNC = 1 << 2,      // The filesystem supports asyncronous I/O.
    FS_DIRECTORIES = 1 << 3,// The filesystem supports directories.
    FS_READONLY = 1 << 4,   // The filesystem is read-only.
    FS_WILDCARDS = 1 << 5,  // The filesystem supports use of wildcards.
    FS_DATAONLY = 1 << 6,   // The filesystem only supports structured data files (JSON).
    FS_OBJECTS = 1 << 7;    // The filesystem supports objects loading via the compiler.

/**
 * Provides a filesystem abstraction to allow implementation of
 * multiple filesystem types (disk-based, SQL-based, ... whatever).
 */
class BaseFileSystem extends MUDEventEmitter {
    /**
     * 
     * @param {FileManager} fileManager
     * @param {FileSystemOptions} opts Options passed from the configuration
     */
    constructor(fileManager, opts) {
        super();

        /** @type {GameServer} */
        this.driver = fileManager.driver;

        /** @type {string} */
        this.encoding = opts.encoding || 'utf8';

        /** @type {number} */
        this.flags = opts.flags || FS_NONE;

        /** @type {FileManager} */
        this.manager = fileManager;

        /** @type {string} */
        this.mp = this.mountPoint = opts.mountPoint;

        /** @type {FileSecurity} */
        this.securityManager = null;

        this.systemId = opts.systemId;

        /** @type {string} */
        this.type = opts.type || 'unknown';
    }

    /**
     * Sets the security manager.
     * @param {FileSecurity} manager The security manager.
     */
    addSecurityManager(manager) {
        this.securityManager = manager;
    }

    assert(flags, error) {
        if ((this.flags & flags) !== flags)
            return false;
        return true;
    }

    assertAsync() {
        if (!this.isAsync)
            throw new Error(`Filesystem type ${this.type} does not support asyncrononous I/O.`);
        return true;
    }

    assertDirectories() {
        if (!this.hasDirectories)
            throw new Error(`Filesystem type ${this.type} does not support directories.`);
        return true;
    }

    assertSync() {
        if (!this.isSync)
            throw new Error(`Filesystem type ${this.type} does not support syncrononous I/O.`);
        return true;
    }

    assertWritable() {
        if (this.isReadOnly())
            throw new Error(`Filesystem ${this.mp} [type ${this.type}] is read-only.`);
        return true;
    }

    /**
     * Create a directory in the filesystem.
     * @param {FileSystemRequest} req The directory expression to create.
     * @param {MkDirOptions} opts Optional flags for createDirectory()
     * @param {function(boolean, Error):void} callback A callback for async mode
     */
    createDirectoryAsync(req, opts, callback) {
        throw new NotImplementedError('createDirectoryAsync');
    }

    /**
     * @returns {FileSystemObject} The final stat object.
     */
    createPermsResult(req, perms, parent) {
        return new FileSystemObject({
            fileName: req,
            perms: perms || {},
            parent: parent || null
        });
    }

    /**
     * Removes a directory from the filesystem.
     * @param {string} req The path of the directory to remove.
     * @param {any} flags TBD
     */
    async deleteDirectoryAsync(req, flags) {
        throw new NotImplementedError('deleteDirectoryAsync');
    }

    async deleteFileAsync(req, callback) {
        throw new NotImplementedError('deleteFileAsync');
    }

    /**
     * Get a directory object
     * @param {string} expr The directory expression to fetch
     * @param {any} flags Flags to control the operation
     */
    getDirectoryAsync(expr, flags = 0) {
        throw new NotImplementedError('getDirectoryAsync');
    }

    /**
     * Get a file object
     * @param {string} expr The file expression to fetch
     * @param {any} flags Flags to control the operation
     */
    getFileAsync(expr, flags = 0) {
        throw new NotImplementedError('getFileAsync');
    }

    /**
     * Converts the expression into the external filesystem absolute path.
     * @param {FileSystemRequest} req The path to translate.
     * @returns {string} The "real" path.
     */
    getRealPath(req) {
        throw new NotImplementedError('deleteFileSync');
    }

    /**
     * Translate an absolute path back into a virtual path.
     * @param {FileSystemRequest} req The absolute path to translate.
     * @returns {string|false} The virtual path if the expression exists in this filesystem or false if not.
     */
    getVirtualPath(req) {
        return false;
    }

    /**
     * Glob a directory
     * @param {string} dir The directory to search
     * @param {string} expr An expression to glob for
     * @param {Glob} options Options to control the operation
     */
    async glob(dir, expr, options = 0) {
        throw new NotImplementedError('glob');
    }

    /**
     * @returns {boolean} Returns true if the filesystem supports directory structures.
     */
    get hasDirectories() {
        return (this.flags & FS_DIRECTORIES) > 0;
    }

    /**
     * @returns {boolean} Returns true if the filesystem supports asyncronous I/O
     */
    get isAsync() {
        return (this.flags & FS_ASYNC) > 0;
    }

    /**
     * @param {FileSystemRequest} request
     * @returns {Promise<boolean>}
     */
    async isDirectoryAsync(request) {
        throw new NotImplementedError('isDirectoryAsync');
    }

    /**
     * @param {FileSystemRequest} request
     */
    async isFileAsync(request) {
        throw new NotImplementedError('isFileAsync');
    }

    /**
     * @returns {boolean} Returns true if the filesystem is read-only.
     */
    get isReadOnly() {
        return (this.flags & FS_READONLY) > 0;
    }

    /**
     * @returns {boolean} Returns true if the filesystem supports syncronous I/O
     */
    get isSync() {
        return (this.flags & FS_SYNC) > 0;
    }

    /**
     * Loads an object from storage.
     * @param {FileSystemRequest} req The path to load the object from.
     * @param {any} args Optional constructor args.
     */
    loadObjectAsync(req, args) {
        throw new NotImplementedError('loadObjectAsync');
    }

    /**
     * Reads a directory listing from the disk.
     * @param {FileSystemRequest} req The directory part of the request.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectoryAsync(req, callback) {
        throw new NotImplementedError('readDirectoryAsync');
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} request The file path expression to read from.
     */
    async readFileAsync(request) {
        throw new NotImplementedError('readFileAsync');
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} req The file path expression to read from.
     * @param {function(string,Error):void} callback The callback that fires when the read is complete.
     */
    async readJsonAsync(expr, callback) {
        throw new NotImplementedError('readJsonAsync');
    }

    /**
     * Stat a file asyncronously.
     * @param {string} relativePath The file expression to stat.
     * @returns {Promise<FileSystemObject>} Returns a stat object.
     */
    async statAsync(relativePath) {
        throw new NotImplementedError('statAsync');
    }

    /**
     * Write content to a file.
     * @param {FileSystemRequest} req
     * @param {string|Buffer} content
     * @param {string|number} [flags] The optional flags to use
     * @param {string} [encoding] The optional encoding to use
     */
    writeFileAsync(req, content, flags, encoding) {
        throw new NotImplementedError('writeFileAsync');
    }
}


// #region Constants

/**
 * Filesystem supports asyncronous operations.
 */
BaseFileSystem.FS_ASYNC = FS_ASYNC;

/**
 * Filesystem ONLY supports structured data.
 */
BaseFileSystem.FS_DATAONLY = FS_DATAONLY;

/**
 * Filesystem supports directories.
 */
BaseFileSystem.FS_DIRECTORIES = FS_DIRECTORIES;

/**
 * Filesystem supports the loading and compiling of MUD objects.
 */
BaseFileSystem.FS_OBJECTS = FS_OBJECTS;

/**
 * Filesystem is read-only.
 */
BaseFileSystem.FS_READONLY = FS_READONLY;

/**
 * Filesystem supports syncronous operations.
 */
BaseFileSystem.FS_SYNC = FS_SYNC;

/**
 * Filesystem supports the use of wildcards.
 */
BaseFileSystem.FS_WILDCARDS = FS_WILDCARDS;

// #endregion

global.MUDFS = {
    GetDirFlags: {
        // FileFlags
        None: 0,
        Verbose: 1 << 0,
        Interactive: 1 << 1,

        // StatFlags
        Size: 1 << 9,
        Perms: 1 << 10,
        Content: 1 << 11,

        Files: 1 << 13,
        Dirs: 1 << 14,
        Implicit: 1 << 15,
        System: 1 << 16,
        Hidden: 1 << 17,

        GetChildren: 1 << 18,
        FullPath: 1 << 19,

        //  Size + Permissions
        Details: 1 << 9 | 1 << 10,

        //  Files + Dirs + Implicit
        Defaults: (1 << 13) | (1 << 14) | (1 << 15)
    },
    MkdirFlags: {
        None: 0,
        Verbose: 1,
        EnsurePath: 1 << 21,
        ExplicitPerms: 1 << 22,
        IgnoreExisting: 1 << 25
    },
    MoveFlags: {
        // FileFlags enum
        None: 0,
        Verbose: 1 << 0,
        Interactive: 1 << 1,

        Backup: 1 << 21,
        NoClobber: 1 << 22,
        Update: 1 << 23,
        SingleFile: 1 << 24
    },
    MoveOptions: {
        backupSuffix: '~',
        flags: 0,
        prompt: false,
        targetDirectory: '.'
    },
    StatFlags: {
        None: 0,
        Size: 1 << 9,
        Perms: 1 << 10,
        Content: 1 << 9 | 1 << 10
    }
};

module.exports = BaseFileSystem;
