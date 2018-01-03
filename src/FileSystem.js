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
    FS_SYNC = 1 << 0,        // The filesystem supports syncronous I/O.
    FS_ASYNC = 1 << 2,       // The filesystem supports asyncronous I/O.
    FS_DIRECTORIES = 1 << 3; // The filesystem supports directories.

/**
 * @class
 * Provides a filesystem abstraction to allow implementation of
 * multiple filesystem types (disk-based, SQL-based, etc).
 */
class FileSystem extends MUDEventEmitter {
    constructor() {
        super();

        /** @type {number} */
        this.flags = FS_SYNC | FS_ASYNC;

        /** @type {string} */
        this.type = 'unknown';
    }

    assertAsync(code) {
        if (!this.isAsync) throw new Error(`Filesystem type ${this.type} does not support asyncrononous I/O.`);
        return code.call(this);
    }

    assertDirectories(code) {
        if (!this.hasDirectories) throw new Error(`Filesystem type ${this.type} does not support directories.`);
        return code ? code.call(this) : true;
    }

    assertSync(code) {
        if (!this.isSync) throw new Error(`Filesystem type ${this.type} does not support syncrononous I/O.`);
        return code.call(this);
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
        throw new Error('appendFileAsync() not implemented.');
    }

    /**
     * Append data to a file in sync mode; Create file if needed.
     * @param {string} path
     * @param {any} content
     */
    appendFileSync(path, content) {
        throw new Error('appendFileSync() not implemented.');
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
        throw new Error('createDirectoryAsync() not implemented');
    }

    createDirectorySync(path) {
        throw new Error('createDirectorySync() not implemented');
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
        throw new Error('createFileAsync() not implemented');
    }

    createFileSync(path, content) {
        throw new Error('createFileSync() not implemented');
    }

    deleteDirectory(path, recursive, callback) {
        throw new Error('deleteDirectory() not implemented.');
    }

    deleteFile(path, callback) {
        throw new Error('deleteFile() not implemented.');
    }

    /**
     * @returns {boolean} Returns true if the filesystem supports directory structures.
     */
    get hasDirectories() { return (this.flags & FS_DIRECTORIES) > 0; }

    /**
     * @returns {boolean} Returns true if the filesystem supports asyncronous I/O
     */
    get isAsync() { return (this.flags & FS_ASYNC) > 0; }

    /**
     * @returns {boolean} Returns true if the filesystem supports syncronous I/O
     */
    get isSync() { return (this.flags & FS_SYNC) > 0; }

    stat(path, callback) {
        if (typeof callback === 'function') {
            if (!this.isAsync) 
                throw new Error()
        }
    }

    writeFile(path) {
        throw new Error('writeFile() not implemented.');
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
 * Filesystem supports syncronous operations.
 */
FileSystem.FS_SYNC = FS_SYNC;

module.exports = FileSystem;

