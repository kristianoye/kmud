/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides an abstraction for the MUD filesystem.
 */
const
    MUDEventEmitter = require('./MUDEventEmitter'),
    MUDExecutionContext = require('./MUDExcecutionContext'),
    { NotImplementedError } = require('./ErrorTypes'),
    FS_NONE = 0,            // No flags set
    FS_SYNC = 1 << 0,       // The filesystem supports syncronous I/O.
    FS_ASYNC = 1 << 2,      // The filesystem supports asyncronous I/O.
    FS_DIRECTORIES = 1 << 3,// The filesystem supports directories.
    FS_READONLY = 1 << 4,   // The filesystem is read-only
    FS_WILDCARDS = 1 << 5,  // The filesystem supports use of wildcards.
    FT_UNKNOWN = 0,
    FT_FILE = 1 << 0,
    FT_DIRECTORY = 1 << 1,
    fs = require('fs'),
    path = require('path');

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
 * multiple filesystem types (disk-based, SQL-based, etc).
 */
class FileSystem extends MUDEventEmitter {
    constructor(opts) {
        super();

        /** @type {string} */
        this.encoding = opts.encoding || 'utf8';

        /** @type {number} */
        this.flags = opts.flags || FS_NONE;

        /** @type {string} */
        this.mp = opts.mountPoint || '';

        /** @type {string} */
        this.type = opts.type || 'unknown';
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
     * @param {string} path
     * @param {any} content
     * @param {Function=} callback
     */
    appendFile(path, content, callback) {
        if (typeof callback === 'function') {
            return this.assertAsync(() => this.appendFileAsync(path, content, MUDExecutionContext.awaiter(callback)));
        }
        else {
            return this.assertSync(() => this.appendFileSync(path, content));
        }
    }

    /**
     * Append data to a file in async mode; Creates file if needed.
     * @param {string} path
     * @param {any} content
     * @param {function(Error):void} callback
     */
    appendFileAsync(path, content, callback) {
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
     * @param {string} path
     * @param {function=} callback
     */
    createDirectory(path, callback) {
        this.assertDirectories();
        if (typeof callback === 'function') {
            return this.assertAsync(() => this.createDirectoryAsync(path, MUDExecutionContext.awaiter(callback)));
        }
        else {
            return this.assertSync(() => this.createDirectorySync(path, content));
        }
    }

    createDirectoryAsync(path, callback) {
        throw new NotImplementedError('createDirectoryAsync');
    }

    createDirectorySync(path) {
        throw new NotImplementedError('createDirectorySync');
    }

    createFile(path, content, callback) {
        if (typeof callback === 'function') {
            if (!this.isAsync) throw new Error(`Filesystem type ${this.type} does not support asyncrononous I/O`);
            return this.createFileAsync(path, content, MUDExecutionContext.awaiter(callback));
        }
        else {
            if (!this.isSync) throw new Error(`Filesystem type ${this.type} does not support syncrononous I/O`);
            return this.createFileSync(path, content);
        }
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

    deleteDirectory(path, recursive, callback) {
        if (typeof callback === 'function') {
            return this.assertAsync(() => this.deleteDirectoryAsync(expr, recursive, MUDExecutionContext.awaiter(callback)));
        }
        else {
            return this.assertSync(() => this.deleteDirectorySync(expr, recursive));
        }
    }

    deleteDirectoryAsync(expr, recursive, callback) {
        throw new NotImplementedError('deleteDirectoryAsync');
    }

    deleteDirectorySync(expr, recursive) {
        throw new NotImplementedError('deleteDirectorySync');
    }

    deleteFile(expr, callback) {
        if (typeof callback === 'function') {
            return this.assertAsync(() => this.deleteFileAsync(expr, MUDExecutionContext.awaiter(callback)));
        }
        else {
            return this.assertSync(() => this.deleteFileSync(expr));
        }
    }

    deleteFileAsync(expr, callback) {
        throw new NotImplementedError('deleteFileAsync');
    }

    deleteFileSync(expr) {
        throw new NotImplementedError('deleteFileSync');
    }

    getFiles(expr, flags, callback) {
        if (typeof flags === 'function') {
            callback = flags;
            flags = 0;
        }
        return typeof callback === 'function' ?
            this.assertAsync(() => this.getFilesAsync(expr, flags, MUDExecutionContext.awaiter(callback))) :
            this.assertSync(() => this.getFilesSync(expr, flags));
    }

    getFilesAsync(expr, flags, callback) {
        throw new NotImplementedError('getFilesAsync');
    }

    getFilesSync(expr, flags) {
        throw new NotImplementedError('getFilesSync');
    }

    /**
     * @returns {boolean} Returns true if the filesystem supports directory structures.
     */
    get hasDirectories() { return (this.flags & FS_DIRECTORIES) > 0; }

    /**
     * @returns {boolean} Returns true if the filesystem supports asyncronous I/O
     */
    get isAsync() { return (this.flags & FS_ASYNC) > 0; }

    get isReadOnly() { return (this.flags & FS_READONLY) > 0; }
    /**
     * @returns {boolean} Returns true if the filesystem supports syncronous I/O
     */
    get isSync() { return (this.flags & FS_SYNC) > 0; }

    /**
     * Stat a file within the filesystem.
     * @param {string} expr The file expression to evaluate.s
     * @param {function(FileSystemStat,Error):void} callback An optional callback for async mode.
     * @returns {FileSystemStat} The filesystem stat info.
     */
    stat(expr, callback) {
        if (typeof callback === 'function') {
            return this.assertAsync(() => this.statAsync(expr, MUDExecutionContext.awaiter(callback)));
        }
        else {
            return this.assertSync(() => this.statSync(expr));
        }
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
        if (typeof callback === 'function') {
            return this.assertAsync(() => this.writeFileAsync(expr, content, MUDExecutionContext.awaiter(callback)));
        }
        else {
            return this.assertSync(() => this.writeFileSync(expr, content));
        }
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
 * Filesystem supports directories.
 */
FileSystem.FS_DIRECTORIES = FS_DIRECTORIES;
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

