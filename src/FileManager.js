/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides a uniform API for accessing the underlying MUD
 * filesystems.
 */
const
    MUDEventEmitter = require('./MUDEventEmitter'),
    FileSystem = require('./FileSystem');

class FileManager extends MUDEventEmitter {
    constructor() {
        super();

        /** @type {Object.<string,FileSystem>} */
        this.fileSystems = {};

        // TODO: Add security abstraction
        this.security = null;
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

    appendFile(path, content, callback) {
        let fs = this.getFileSystem(path);
        return fs.appendFile(path, content, callback);
    }

    createDirectory(path, callback) {
        let fs = this.getFileSystem(path);
        return fs.createDirectory(path, callback);
    }

    createFile(path, content, callback) {

    }
}

module.exports = FileManager;
