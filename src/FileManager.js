/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides a uniform API for accessing the underlying MUD
 * filesystems.
 *
 * 
 */
const
    MUDEventEmitter = require('./MUDEventEmitter'),
    FileSystem = require('./FileSystem').FileSystem,
    FileSecurity = require('./FileSecurity');

var
    /** @type {FileManager} */
    FileManagerInstance = false;

class FileManager extends MUDEventEmitter {
    /**
     * Construct the file manager
     * @param {FileSecurity} security The security manager.
     */
    constructor(security) {
        super();

        if (FileManager)
            throw new Error('Only one file manager instance may be created');

        /** @type {Object.<string,FileSystem>} */
        this.fileSystems = {};

        /** @type {FileSecurity} */
        this.security = security;

        FileManagerInstance = this;
    }

    /**
     * Returns the filesystem for the specified path.
     * @param {string} path The path being requested.
     * @returns {FileSystem} The filesystem supporting the specified path.
     */
    getFileSystem(path) {
        let parts = path.split('/'),
            result = this.fileSystems['/'] || false;

        while (parts.length) {
            let dir = '/' + parts.join('/');
            if (dir in this.fileSystems) {
                result = this.fileSystems[dir];
                break;
            }
            parts.pop();
        }
        if (!result)
            throw new Error('Fatal: Could not locate filesystem');
        return result;
    }

    appendFile(caller, path, content, callback) {
        let fs = this.getFileSystem(path);
        return fs.appendFile(path, content, callback);
    }

    createDirectory(caller, expr, callback) {
        let fs = this.getFileSystem(expr);
        return fs.createDirectory(expr, callback);
    }

    createFile(caller, expr, content, callback) {
        if (this.security.validStatFile(caller, expr)) {

        }
    }

    statFile(caller, expr, flags, callback) {
        if (this.security.validStatFile(caller, expr, flags || 0)) {
            let mfs = this.getFileSystem(expr);
            return mfs.stat(expr, callback);
        }
    }
}

/**
 * Fetch the filesystem manager instance.
 * @returns {FileManager}
 */
FileManager.get = function () { return FileManagerInstance; };

module.exports = FileManager;
