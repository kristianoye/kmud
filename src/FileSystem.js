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
    /**
     * Construct a new stat
     * @param {FileSystemStat} data
     */
    constructor(data) {
        this.merge(data || {});
    }

    assertValid() {
        if (!this.name)
            throw new Error('Illegal stat object has no name');
        return this;
    }

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

    /**
     * 
     * @param {FileSystemStat} data
     * @returns {FileSystemStat}
     */
    merge(data) {
        /** @type {number} */
        this.atime = data.atime || this.atime || 0;

        /** @type {number} */
        this.blocks = data.blocks || this.blocks || 0;

        /** @type {number} */
        this.blockSize = data.blockSize || this.blockSize || 0;

        /** @type {number} */
        this.ctime = data.ctime || this.ctime || 0;

        /** @type {number} */
        this.dev = data.dev || this.dev || 0;

        /** @type {boolean} */
        this.exists = data.exists || this.exists || false;

        /** @type {boolean} */
        this.isDirectory = data.isDirectory || this.isDirectory || false;
        if (typeof this.isDirectory === 'function')
            this.isDirectory = data.isDirectory();

        /** @type {boolean} */
        this.isFile = data.isFile || this.isFile || false;
        if (typeof this.isFile === 'function')
            this.isFile = data.isFile();

        /** @type {number} */
        this.mtime = data.mtime || this.mtime || 0;

        /** @type {string} */
        this.name = data.name || this.name || false;

        /** @type {FileSystemStat} */
        this.parent = data.parent || this.parent || false;

        /** @type {string} */
        this.path = data.path || this.parent + this.name;

        /** @type {Object.<string,number>} */
        this.perms = data.perms || this.perms || {};

        /** @type {number} */
        this.size = data.size || this.size || 0;

        /** @type {number} */
        this.type = data.type || this.type || FT_UNKNOWN; 

        return this;
    }
}

/**
 * @param {FileSystemStat} result The spec to create a stat from.
 * @returns {FileSystemStat} An actual stat object.
 */
FileSystemStat.create = function (result) {
    return new FileSystemStat(result);
};

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
     * Append data to a file; Creates file if needed.
     * @param {string} req The file to append data to.
     * @param {any} content The content to write to file.
     * @param {function(boolean,Error):void} callback A callback to fire with success status.
     */
    appendFile(req, content, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.appendFileAsync(req, content, callback) :
            this.assertSync() && this.appendFileSync(req, content);
    }

    /**
     * Append data to a file in async mode; Creates file if needed.
     * @param {string} req The file to append data to.
     * @param {any} content The content to write to file.
     * @param {function(Error):void} callback A callback to fire with success status.
     */
    appendFileAsync(req, content, callback) {
        throw new NotImplementedError('appendFileAsync');
    }

    /**
     * Append data to a file in sync mode; Create file if needed.
     * @param {string} req
     * @param {any} content
     */
    appendFileSync(req, content) {
        throw new NotImplementedError('appendFileSync');
    }

    /**
     * Clone an object
     * @param {FileSystemRequest} req The clone request
     * @param {any} args Constructor args
     * @param {function(MUDObject,Error):void} callback Callback for async cloneObject() request
     */
    cloneObject(req, args, callback) {
        return typeof callback !== 'undefined' ?
            this.cloneObjectAsync(req, args, callback) :
            this.cloneObjectSync(req, args);
    }

    /**
     * Create a directory in the filesystem.
     * @param {FileSystemRequest} req The directory expression to create.
     * @param {MkDirOptions} opts Optional flags for createDirectory()
     * @param {function(boolean, Error):void} callback A callback for async mode
     */
    createDirectory(req, opts, callback) {
        this.assertDirectories();
        return typeof callback === 'function' ?
            this.assertAsync() && this.createDirectoryAsync(req, opts, callback) :
            this.assertSync() && this.createDirectorySync(req, opts);
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
     * Create a directory in the filesystem.
     * @param {FileSystemRequest} req The directory expression to create.
     * @param {MkDirOptions} opts Optional flags for createDirectory()
     */
    createDirectorySync(req, opts) {
        throw new NotImplementedError('createDirectorySync');
    }

    /**
     * @returns {FileSystemStat} The final stat object.
     */
    createPermsResult(req, perms, parent) {
        return new FileSystemStat({
            fileName: req,
            perms: perms || {},
            parent: parent || null
        });
    }

    /**
     * Removes a directory from the filesystem.
     * @param {FileSystemRequest} req The path of the directory to remove.
     * @param {any} flags TBD
     * @param {function(boolean,Error):void} callback Callback for async operation
     */
    deleteDirectory(req, flags, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.deleteDirectoryAsync(req, flags, callback) :
            this.assertSync() && this.deleteDirectorySync(req, flags);
    }

    /**
     * Removes a directory from the filesystem.
     * @param {FileSystemRequest} req The path of the directory to remove.
     * @param {any} flags TBD
     * @param {function(boolean,Error):void} callback Callback for async operation
     */
    deleteDirectoryAsync(req, flags, callback) {
        throw new NotImplementedError('deleteDirectoryAsync');
    }

    /**
     * Removes a directory from the filesystem.
     * @param {FileSystemRequest} req The path of the directory to remove.
     * @param {any} flags TBD
     */
    deleteDirectorySync(req, flags) {
        throw new NotImplementedError('deleteDirectorySync');
    }

    deleteFile(req, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.deleteFileAsync(req, callback) :
            this.assertSync() && this.deleteFileSync(req);
    }

    deleteFileAsync(req, callback) {
        throw new NotImplementedError('deleteFileAsync');
    }

    deleteFileSync(req) {
        throw new NotImplementedError('deleteFileSync');
    }

    /**
     * Converts the expression into the external filesystem absolute path.
     * @param {FileSystemRequest} req The path to translate.
     * @returns {string} The "real" path.
     */
    getRealPath(req)
    {
        throw new NotImplementedError('deleteFileSync');
    }

    /**
     * Translate an absolute path back into a virtual path.
     * @param {FileSystemRequest} req The absolute path to translate.
     * @returns {string|false} The virtual path if the expression exists in this filesystem or false if not.
     */
    getVirtualPath(req) { return false; }

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
     * @param {FileSystemRequest} req
     * @param {function(boolean, Error):void} callback
     */
    isDirectory(req, callback) {
        this.assertDirectories();
        return typeof callback === 'function' ?
            this.assertAsync() && this.isDirectoryAsync(req, callback) :
            this.assertSync() && this.isDirectorySync(req);
    }

    /**
     * @param {FileSystemRequest} req
     * @param {function(boolean,Error):void} callback
     */
    isDirectoryAsync(req, callback) {
        throw new NotImplementedError('isDirectoryAsync');
    }

    /**
     * @param {FileSystemRequest} req
     */
    isDirectorySync(req) {
        throw new NotImplementedError('isDirectorySync');
    }

    /**
     * Checks to see if the expression is a directory.
     * @param {FileSystemRequest} req
     * @param {function(boolean, Error):void} callback
     */
    isFile(req, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.isFileAsync(req, callback) :
            this.assertSync() && this.isFileSync(req);
    }

    /**
     * @param {FileSystemRequest} req
     * @param {function(boolean,Error):void} callback
     */
    isFileAsync(req, callback) {
        throw new NotImplementedError('isFileAsync');
    }

    /**
     * @param {FileSystemRequest} req
     */
    isFileSync(req) {
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
     * @param {FileSystemRequest} req The path to load the object from.
     * @param {any} args Optional constructor args.
     * @param {function(MUDModule,Error):void} callback The callback if load object is called async
     */
    loadObject(req, args, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.loadObjectAsync(req, args, callback) :
            this.assertSync() && this.loadObjectSync(req, args);
    }

    /**
     * Loads an object from storage.
     * @param {FileSystemRequest} req The path to load the object from.
     * @param {any} args Optional constructor args.
     * @param {function(MUDModule,Error):void} callback Callback that fires if load object was async.
     */
    loadObjectAsync(req, args, callback) {
        throw new NotImplementedError('loadObjectAsync');
    }

    /**
     * Loads an object from storage.
     * @param {FileSystemRequest} req The path to load the object from.
     * @param {any} args Optional constructor args.
     */
    loadObjectSync(req, args) {
        throw new NotImplementedError('loadObjectSync');
    }

    /**
     * Reads a directory listing from the disk.
     * @param {FileSystemRequest} req The directory part of the request.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectory(req, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.readDirectoryAsync(req, callback) :
            this.assertSync() && this.readDirectorySync(req);
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
     * Reads a directory listing from the disk.
     * @param {FileSystemRequest} req The directory part of the request.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectorySync(req) {
        throw new NotImplementedError('readDirectorySync');
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} req The file path expression to read from.
     * @param {function(string,Error):void} callback The callback that fires when the read is complete.
     */
    readFile(req, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.readFileAsync(req, callback) :
            this.assertSync() && this.readFileSync(req);
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} req The file path expression to read from.
     * @param {function(string,Error):void} callback The callback that fires when the read is complete.
     */
    readFileAsync(req, callback) {
        throw new NotImplementedError('readFileAsync');
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} req The file path expression to read from.
     */
    readFileSync(req) {
        throw new NotImplementedError('readFileSync');
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} req The file path expression to read from.
     * @param {function(string,Error):void} callback The callback that fires when the read is complete.
     * @returns {any} Returns void if async or data if successful read.
     */
    readJsonFile(req, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.readJsonFileAsync(req, callback) :
            this.assertSync() && this.readJsonFileSync(req);
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} req The file path expression to read from.
     * @param {function(string,Error):void} callback The callback that fires when the read is complete.
     */
    readJsonFileAsync(expr, callback) {
        throw new NotImplementedError('readJsonFileAsync');
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} req The file path expression to read from.
     * @param {function(string,Error):void} callback The callback that fires when the read is complete.
     */
    readJsonFileSync(expr) {
        throw new NotImplementedError('readJsonFileSync');
    }

    /**
     * Stat a file within the filesystem.
     * @param {FileSystemRequest} req The file expression to evaluate.s
     * @param {function(FileSystemStat,Error):void} callback An optional callback for async mode.
     * @returns {FileSystemStat} The filesystem stat info.
     */
    stat(req, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.statAsync(req, callback) :
            this.assertSync() && this.statSync(req);
    }

    /**
     * Stat a file asyncronously.
     * @param {FileSystemRequest} req The file expression to stat.
     * @param {function(FileSystemStat,Error):void} callback
     */
    statAsync(req, callback) {
        throw new NotImplementedError('statAsync');
    }

    /**
     * Stat a file syncronously.
     * @param {FileSystemRequest} req The file expression to stat.
     */
    statSync(req) {
        throw new NotImplementedError('statSync');
    }

    /**
     * Write content to a file.
     * @param {FileSystemRequest} req
     * @param {string|Buffer} content
     * @param {function(boolean, Error):void} callback
     */
    writeFile(req, content, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.writeFileAsync(req, content, callback) :
            this.assertSync() && this.writeFileSync(req, content);
    }

    /**
     * Write content to a file.
     * @param {FileSystemRequest} req
     * @param {string|Buffer} content
     * @param {function(boolean, Error):void} callback
     */
    writeFileAsync(req, content, callback) {
        throw new NotImplementedError('writeFileAsync');
    }

    /**
     * Write content to a file.
     * @param {FileSystemRequest} req
     * @param {string|Buffer} content
     */
    writeFileSync(req, content) {
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

