/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides an abstraction for the MUD filesystems.
 */
const
    MUDEventEmitter = require('./MUDEventEmitter'),
    { NotImplementedError } = require('./ErrorTypes'),
    FS_NONE = 0,            // No flags set
    FS_SYNC = 1 << 0,       // The filesystem supports syncronous I/O.
    FS_ASYNC = 1 << 2,      // The filesystem supports asyncronous I/O.
    FS_DIRECTORIES = 1 << 3,// The filesystem supports directories.
    FS_READONLY = 1 << 4,   // The filesystem is read-only.
    FS_WILDCARDS = 1 << 5,  // The filesystem supports use of wildcards.
    FS_DATAONLY = 1 << 6,   // The filesystem only supports structured data files (JSON).
    FS_OBJECTS = 1 << 7,    // The filesystem supports objects loading via the compiler.
    FT_UNKNOWN = 0,         // Symbolic links, Windows Junctions, file sockets, and other currently unsuppported types.
    FT_FILE = 1 << 0,       // The target is a regular file.
    FT_DIRECTORY = 1 << 1,  // The target is a directory.
    fs = require('fs'),
    path = require('path'),
    MXC = require('./MXC');

class FileSystemStat {
    constructor(data) {
        /** @type {boolean} */
        this.exists = data.exists || false;

        /** @type {FileSystemStat} */
        this.parent = data.parent || false;

        /** @type {Object.<string,number>} */
        this.perms = data.perms || {};

        /** @type {number} */
        this.type = data.perms || FT_UNKNOWN; 
    }

    assertValid() { return this; }

    /**
     * Creates a deep clone of the stat that is safe to return to the MUD.
     */
    clone() {
        let result = {
            exists: this.exists,
            parent: this.parent ? this.parent.clone() : null,
            perms: {},
            type: this.type
        };

        Object.keys(this.perms).forEach(k => {
            result.perms[k] = this.perms[k];
        });

        return result;
    }
}

/**
 * @class
 * Provides a filesystem abstraction to allow implementation of
 * multiple filesystem types (disk-based, SQL-based, ... whatever).
 */
class FileSystem extends MUDEventEmitter {
    /**
     * 
     * @param {FileManager} fileManager
     * @param {any} opts
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
        this.mp = opts.mountPoint || '';

        /** @type {FileSecurity} */
        this.securityManager = null;

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
            throw new Error(error);
        return true;
    }

    assertAsync(code) {
        if (!this.isAsync)
            throw new Error(`Filesystem type ${this.type} does not support asyncrononous I/O.`);
        return code.call(this);
    }

    assertDirectories(code) {
        if (!this.hasDirectories)
            throw new Error(`Filesystem type ${this.type} does not support directories.`);
        return code ? code.call(this) : true;
    }

    assertSync(code) {
        if (!this.isSync)
            throw new Error(`Filesystem type ${this.type} does not support syncrononous I/O.`);
        return code ? code.call(this) : true;
    }

    assertWritable(code) {
        if (this.isReadOnly())
            throw new Error(`Filesystem ${this.mp} [type ${this.type}] is read-only.`);
        return code ? code.call(this) : true;
    }

    /**
     * Append data to a file; Creates file if needed.
     * @param {string} expr The file to append data to.
     * @param {any} content The content to write to file.
     * @param {function(boolean,Error):void} callback A callback to fire with success status.
     */
    appendFile(expr, content, callback) {
        return typeof callback === 'function' ?
            this.assertAsync(() => this.appendFileAsync(expr, content, MXC.awaiter(callback))) :
            this.assertSync(() => this.appendFileSync(expr, content));
    }

    /**
     * Append data to a file in async mode; Creates file if needed.
     * @param {string} expr The file to append data to.
     * @param {any} content The content to write to file.
     * @param {function(Error):void} callback A callback to fire with success status.
     */
    appendFileAsync(expr, content, callback) {
        throw new NotImplementedError('appendFileAsync');
    }

    /**
     * Append data to a file in sync mode; Create file if needed.
     * @param {string} path
     * @param {any} content
     */
    appendFileSync(path, content) {
        throw new NotImplementedError('appendFileSync');
    }

    /**
     * Create a directory in the filesystem.
     * @param {string} expr The directory expression to create.
     * @param {MkDirOptions} opts Optional flags for createDirectory()
     * @param {function=} callback
     */
    createDirectory(expr, opts, callback) {
        this.assertDirectories();
        return typeof callback === 'function' ?
            this.assertAsync(() => this.createDirectoryAsync(expr, opts, MXC.awaiter(callback))) :
            this.assertSync(() => this.createDirectorySync(expr, opts));
    }

    createDirectoryAsync(expr, flags, callback) {
        throw new NotImplementedError('createDirectoryAsync');
    }

    createDirectorySync(expr, flags) {
        throw new NotImplementedError('createDirectorySync');
    }

    createFile(expr, content, callback) {
        return typeof callback === 'function' ?
            this.assertAsync(() => this.createFileAsync(expr, content, MXC.awaiter(callback))) :
            this.assertSync(() => this.createFileSync(expr, content));
    }

    createFileAsync(path, content, callback) {
        throw new NotImplementedError('createFileAsync');
    }

    createFileSync(path, content) {
        throw new Error('createFileSync() not implemented');
    }

    /**
     * @returns {FileSystemStat} The final stat object.
     */
    createPermsResult(expr, perms, parent) {
        return new FileSystemStat({
            fileName: expr,
            perms: perms || {},
            parent: parent || null
        });
    }

    /**
     * Removes a directory from the filesystem.
     * @param {string} expr The path of the directory to remove.
     * @param {any} flags TBD
     * @param {function(boolean,Error):void} callback Callback for async operation
     */
    deleteDirectory(expr, flags, callback) {
        return typeof callback === 'function' ?
            this.assertAsync(() => this.deleteDirectoryAsync(expr, flags, MXC.awaiter(callback))) :
            this.assertSync(() => this.deleteDirectorySync(expr, flags));
    }

    /**
     * Removes a directory from the filesystem.
     * @param {string} expr The path of the directory to remove.
     * @param {any} flags TBD
     * @param {function(boolean,Error):void} callback Callback for async operation
     */
    deleteDirectoryAsync(expr, flags, callback) {
        throw new NotImplementedError('deleteDirectoryAsync');
    }

    /**
     * Removes a directory from the filesystem.
     * @param {string} expr The path of the directory to remove.
     * @param {any} flags TBD
     */
    deleteDirectorySync(expr, flags) {
        throw new NotImplementedError('deleteDirectorySync');
    }

    deleteFile(expr, callback) {
        return typeof callback === 'function' ?
            this.assertAsync(() => this.deleteFileAsync(expr, MXC.awaiter(callback))) :
            this.assertSync(() => this.deleteFileSync(expr));
    }

    deleteFileAsync(expr, callback) {
        throw new NotImplementedError('deleteFileAsync');
    }

    deleteFileSync(expr) {
        throw new NotImplementedError('deleteFileSync');
    }

    /**
     * Converts the expression into the "real" underlying path.
     * @param {string} expr The path to translate.
     * @returns {string} The "real" path.
     */
    getRealPath(expr) { return expr; }

    getStat(expr, callback) {
        return typeof callback === 'function' || callback === false ?
            this.assertAsync(async () => this.getStatAsync(expr, callback)) :
            this.assertSync(() => this.getStatSync(expr));
    }

    getStatAsync(expr) {
        throw new NotImplementedError('getStatAsync');
    }

    getStatSync(expr) {
        throw new NotImplementedError('getStatSync');
    }

    /**
     * Translate an absolute path back into a virtual path.
     * @param {string} expr The absolute path to translate.
     * @returns {string|false} The virtual path if the expression exists in this filesystem or false if not.
     */
    getVirtualPath(expr) { return false; }

    /**
     * @returns {boolean} Returns true if the filesystem supports directory structures.
     */
    get hasDirectories() {
        return (this.flags & FS_DIRECTORIES) > 0;
    }

    /**
     * @returns {boolean} Returns true if the filesystem supports asyncronous I/O
     */
    get isAsync() { return (this.flags & FS_ASYNC) > 0; }

    /**
     * Checks to see if the expression is a directory.
     * @param {string} expr
     * @param {function(boolean, Error):void} callback
     */
    isDirectory(expr, callback) {
        return this.assertDirectories(() => {
            return typeof callback === 'function' ?
                this.assertAsync(() => this.isDirectoryAsync(expr, callback)) :
                this.assertSync(() => this.isDirectorySync(expr));
        });
    }

    isDirectoryAsync(expr, callback) {
        throw new NotImplementedError('isDirectoryAsync');
    }

    isDirectorySync(expr) {
        throw new NotImplementedError('isDirectorySync');
    }

    /**
     * Checks to see if the expression is a directory.
     * @param {string} expr
     * @param {function(boolean, Error):void} callback
     */
    isFile(expr, callback) {
        return typeof callback === 'function' ?
            this.assertAsync(() => this.isFileAsync(expr, callback)) :
            this.assertSync(() => this.isFileSync(expr));
    }

    isFileAsync(expr, callback) {
        throw new NotImplementedError('isFileAsync');
    }

    isFileSync(expr) {
        throw new NotImplementedError('isFileSync');
    }

    /**
     * @returns {boolean} Returns true if the filesystem is read-only.
     */
    get isReadOnly() { return (this.flags & FS_READONLY) > 0; }

    /**
     * @returns {boolean} Returns true if the filesystem supports syncronous I/O
     */
    get isSync() { return (this.flags & FS_SYNC) > 0; }

    /**
     * Loads an object from storage.
     * @param {string} expr The path to load the object from.
     * @param {any} args Optional constructor args.
     * @param {function=} callback
     */
    loadObject(expr, args, callback) {
        return typeof callback === 'function' ?
            this.assertAsync(() => this.loadObjectAsync(expr, args, MXC.awaiter(callback))) :
            this.assertSync(() => this.loadObjectSync(expr, args));
    }

    /**
     * Loads an object from storage.
     * @param {string} expr The path to load the object from.
     * @param {any} args Optional constructor args.
     * @param {function=} callback
     */
    loadObjectAsync(expr, args, callback) {
        throw new NotImplementedError('loadObjectAsync');
    }

    /**
     * Loads an object from storage.
     * @param {string} expr The path to load the object from.
     * @param {any} args Optional constructor args.
     */
    loadObjectSync(expr, args) {
        throw new NotImplementedError('loadObjectSync');
    }

    /**
     * Reads a directory listing from the disk.
     * @param {string} expr The directory part of the request.
     * @param {numeric} flags Numeric flags indicating requests for additional detail.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectory(expr, flags, callback) {
        if (typeof flags === 'function') {
            callback = flags;
            flags = 0;
        }
        return typeof callback === 'function' ?
            this.assertAsync(() => this.readDirectoryAsync(expr, flags, MXC.awaiter(callback))) :
            this.assertSync(() => this.readDirectorySync(expr, flags));
    }

    /**
     * Reads a directory listing from the disk.
     * @param {string} expr The directory part of the request.
     * @param {numeric} flags Numeric flags indicating requests for additional detail.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectoryAsync(expr, flags, callback) {
        throw new NotImplementedError('readDirectoryAsync');
    }

    /**
     * Reads a directory listing from the disk.
     * @param {string} expr The directory part of the request.
     * @param {numeric} flags Numeric flags indicating requests for additional detail.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectorySync(expr, flags) {
        throw new NotImplementedError('readDirectorySync');
    }

    /**
     * Read a file from the filesystem;
     * @param {string} expr The file path expression to read from.
     * @param {function(string,Error):void} callback The callback that fires when the read is complete.
     */
    readFile(expr, callback) {
        return typeof callback === 'function' ?
            this.assertAsync(() => this.readFileAsync(expr, MXC.awaiter(callback))) :
            this.assertSync(() => this.readFileSync(expr));
    }

    readFileAsync(expr, callback) {
        throw new NotImplementedError('readFileAsync');
    }

    readFileSync(expr) {
        throw new NotImplementedError('readFileSync');
    }

    readJsonFile(expr, callback) {
        return typeof callback === 'function' ?
            this.assertAsync(() => this.readJsonFileAsync(expr, MXC.awaiter(callback))) :
            this.assertSync(() => this.readJsonFileSync(expr));
    }

    readJsonFileAsync(expr, callback) {
        throw new NotImplementedError('readJsonFileAsync');
    }

    readJsonFileSync(expr) {
        throw new NotImplementedError('readJsonFileSync');
    }

    /**
     * Stat a file within the filesystem.
     * @param {string} expr The file expression to evaluate.s
     * @param {function(FileSystemStat,Error):void} callback An optional callback for async mode.
     * @returns {FileSystemStat} The filesystem stat info.
     */
    stat(expr, callback) {
        return typeof callback === 'function' ?
            this.assertAsync(() => this.statAsync(expr, MXC.awaiter(callback))) :
            this.assertSync(() => this.statSync(expr));
    }

    /**
     * Stat a file asyncronously.
     * @param {string} expr The file expression to stat.
     * @param {function(FileSystemStat,Error):void} callback
     */
    statAsync(expr, callback) {
        throw new NotImplementedError('statAsync');
    }

    /**
     * Stat a file syncronously.
     * @param {string} expr The file expression to stat.
     */
    statSync(expr) {
        throw new NotImplementedError('statSync');
    }

    writeFile(expr, content, callback) {
        return typeof callback === 'function' ?
            this.assertAsync(() => this.writeFileAsync(expr, content, MXC.awaiter(callback))) :
            this.assertSync(() => this.writeFileSync(expr, content));
    }

    writeFileAsync(expr, content, callback) {
        throw new NotImplementedError('writeFileAsync');
    }

    writeFileSync(expr, content) {
        throw new NotImplementedError('writeFileSync');
    }
}

/**
 * Filesystem supports asyncronous operations.
 */
FileSystem.FS_ASYNC = FS_ASYNC;

/**
 * Filesystem ONLY supports structured data.
 */
FileSystem.FS_DATAONLY = FS_DATAONLY;

/**
 * Filesystem supports directories.
 */
FileSystem.FS_DIRECTORIES = FS_DIRECTORIES;

/**
 * Filesystem supports the loading and compiling of MUD objects.
 */
FileSystem.FS_OBJECTS = FS_OBJECTS;

/**
 * Filesystem is read-only.
 */
FileSystem.FS_READONLY = FS_READONLY;

/**
 * Filesystem supports syncronous operations.
 */
FileSystem.FS_SYNC = FS_SYNC;

/**
 * Filesystem supports the use of wildcards.
 */
FileSystem.FS_WILDCARDS = FS_WILDCARDS;

module.exports = {
    FileSystem,
    FileSystemStat
};

