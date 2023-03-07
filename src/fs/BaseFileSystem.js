const { NotImplementedError } = require('../ErrorTypes');
const
    MUDEventEmitter = require('../MUDEventEmitter');
const FileSystemQuery = require('./FileSystemQuery');

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
 * 
 * The file manager ultimately provides a single method: getObjectAsyc.
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

        this.systemId = opts.systemId;

        /** @type {string} */
        this.type = opts.type || 'unknown';
    }

    /**
     * Get an object from the filesystem
     * @param {any} expr
     * @param {any} flags
     */
    async getObjectAsync(expr, flags = 0) {
        throw new NotImplementedError('getObjectAsync');
    }

    /**
     * Query the filesystem
     * @param {FileSystemQuery} query
     */
    queryFileSystemAsync(query) {
        throw new NotImplementedError('queryFileSystemAsync');
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
