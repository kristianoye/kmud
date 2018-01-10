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
    { MudlibFileMount } = require('./config/MudlibFileSystem'),
    FileSystem = require('./FileSystem').FileSystem,
    path = require('path'),
    fs = require('fs');

mudglobal.GetDirFlags = {
    None: 0,
    Files: 1 << 1,
    Dirs: 1 << 2,
    Perms: 1 << 3,
    System: 1 << 4,
    Size: 1 << 0
};

mudglobal.MkdirFlags = {
    EnsurePath: 1
};

mudglobal.StatFlags = {
    None: 0,
    Size: 1 << 0,
    Perms: 1 << 3,
    Parent: 1 << 4
};

var
    /** @type {FileManager} */
    FileManagerInstance = false;

class FileSystemRequest {
    /**
     * Creates a filesystem request.
     * @param {string} relativePath
     * @param {string} fullPath
     * @param {FileSystem} fileSystem
     */
    constructor(relativePath, fullPath, fileSystem) {
        /** @type {string} */
        this.relativePath = relativePath;

        /** @type {string} */
        this.fullPath = fullPath;

        /** @type {FileSystem} */
        this.filesystem = fileSystem;

        /** @type {FileSecurity} */
        this.securityManager = fileSystem.securityManager;
    }
}

class FileManager extends MUDEventEmitter {
    /**
     * Construct the file manager
     * @param {GameServer} driver The game driver instance.
     * @param {string} mudlibRoot The root directory specified in the config.
     * @param {Object.<string,any>} options Additional options from the config.
     */
    constructor(driver, mudlibRoot, options) {
        super();

        if (FileManagerInstance)
            throw new Error('Only one file manager instance may be created');

        /** @type {GameServer} */
        this.driver = driver;

        /** @type {Object.<string,FileSystem>} */
        this.fileSystems = {};

        /** @type {string} */
        this.mudlibRoot = mudlibRoot;

        /** @type {string} */
        this.mudlibAbsolute = path.resolve(__dirname, this.mudlibRoot);

        FileManagerInstance = this;
    }

    assertValid() { return this; }

    /**
     * 
     * @param {function(FileSystem,string):any[]} callback
     */
    eachFileSystem(callback) {
        return Object.keys(this.fileSystems)
            .map(id => callback(this.fileSystems[id], id));
    }

    /**
     * Returns the filesystem for the specified path.
     * @param {string} expr The path being requested.
     * @param {function(FileSystemRequest):any} callback An optional callback.
     * @returns {FileSystemRequest} The filesystem supporting the specified path.
     */
    createFileRequest(expr, callback) {
        let parts = expr.split('/'),
            result = this.fileSystems['/'] || false,
            relParts = [], relPath = expr.slice(1);

        while (parts.length) {
            let dir = parts.join('/');
            if (dir in this.fileSystems) {
                relPath = relParts.join('/');
                result = this.fileSystems[dir];
                break;
            }
            relParts.unshift(parts.pop());
        }
        if (!result)
            throw new Error('Fatal: Could not locate filesystem');

        return callback ?
            callback(new FileSystemRequest(relPath, expr, result)) :
            new FileSystemRequest(relPath, expr, result);
    }

    /**
     * Create the specified filesystem.
     * @param {MudlibFileMount} fsconfig The filesystem to mount.
     */
    createFileSystem(fsconfig) {
        let fileSystemType = require(path.join(__dirname, fsconfig.type)),
            securityManagerType = require(path.join(__dirname, fsconfig.securityManager)),
            fileSystem = this.fileSystems[fsconfig.mountPoint] = new fileSystemType(this, fsconfig.options),
            securityManager = new securityManagerType(this, fileSystem, fsconfig.securityManagerOptions);
        return fileSystem;
    }

    appendFile(path, content, callback) {
        let fs = this.createFileRequest(path);
        return fs.appendFile(path, content, callback);
    }

    /**
     * Create a directory in the MUD filesystem.
     * @param {EFUNProxy} efuns The object creating the directory.
     * @param {string} expr The path to create.
     * @param {number} flags Optional flags to pass to the mkdir method.
     * @param {function(boolean,Error):void} callback A callback to fire if async
     */
    createDirectory(efuns, expr, flags, callback) {
        return this.createFileRequest(expr, req => {
            return req.securityManager.validCreateDirectory(efuns, req.fullPath) ?
                req.filesystem.createDirectory(req.relativePath, flags, callback) :
                req.securityManager.denied('createDirectory', req.fullPath);
        });
    }

    createFile(expr, content, callback) {
    }

    /**
     * Delete/unlink a file from the filesystem.
     * @param {EFUNProxy} efuns The object requesting the deletion.
     * @param {string} expr The path expression to remove.
     * @param {callback(boolean, Error):void} callback Callback for async deletion.
     */
    deleteFile(efuns, expr, callback) {
        return this.createFileRequest(expr, req => {
            return req.securityManager.validDeleteFile(efuns, req.fullPath) ?
                req.filesystem.deleteFile(req.relativePath, callback) :
                req.securityManager.denied('delete', req.fullPath);
        });
    }

    /**
     * Load an object from disk.
     * @param {EFUNProxy} efuns The efuns instance making the call.
     * @param {string} mudpath
     * @param {any} args
     * @param {function=} callback
     */
    loadObject(efuns, mudpath, args, callback) {
        return this.createFileRequest(mudpath, req => {
            return req.securityManager.validLoadObject(efuns, req.fullPath) ?
                req.filesystem.loadObject(req.relativePath, args, callback) :
                req.securityManager.denied('load', req.fullPath);
        });
    }

    /**
     * Read files from a directory.
     * @param {EFUNProxy} efuns The object requesting the directory listing.
     * @param {string} mudpath The MUD virtual path to read from.
     * @param {number} flags Flags indicating request for additional details.
     * @param {function(string[], Error):void} callback A callback for asyncronous reading.
     */
    readDirectory(efuns, mudpath, flags, callback) {
        let muddir = mudpath.endsWith('/') ? mudpath : mudpath.slice(0, mudpath.lastIndexOf('/')),
            filePart = mudpath.slice(muddir.length);

        return this.createFileRequest(muddir, req => {
            return req.securityManager.validReadDirectory(efuns, muddir) ?
                req.filesystem.readDirectory(req.relativePath, filePart, flags, callback) :
                req.securityManager.denied('list', req.fullPath);
        });
    }

    /**
     * Reads a file from the filesystem.
     * @param {EFUNProxy} efuns The efuns instance making the call.
     * @param {string} expr The file to try and read.
     * @param {function=} callback An optional callback for async mode.
     */
    readFile(efuns, expr, callback) {
        return this.createFileRequest(expr, req => {
            return req.securityManager.validReadFile(efuns, req.fullPath) ?
                req.filesystem.readFile(req.relativePath, callback) :
                req.securityManager.denied('read', req.fullPath);
        });
    }

    /**
     * Read structured data from the specified location.
     * @param {EFUNProxy} efuns The efuns instance making the call.
     * @param {string} expr The JSON file being read.
     * @param {function=} callback An optional callback for async mode.
     */
    readJsonFile(efuns, expr, callback) {
        return this.createFileRequest(expr, req => {
            return req.securityManager.validReadFile(efuns, req.fullPath) ?
                req.filesystem.readJsonFile(req.relativePath, callback) :
                req.securityManager.denied('read', req.fullPath);
        });
    }

    /**
     * Remove a directory from the filesystem.
     * @param {EFUNProxy} efuns
     * @param {string} expr
     * @param {any} flags
     * @param {function(boolean,Error):void} callback
     */
    removeDirectory(efuns, expr, flags, callback) {
        return this.createFileRequest(expr, req => {
            return req.securityManager.validDeleteDirectory(efuns, req.fullPath) ?
                req.filesystem.deleteDirectory(req, flags, callback) :
                req.securityManager.denied('removeDirectory', req.fullPath);
        });
    }

    /**
     * Stat a filesystem expression
     * @param {EFUNProxy} efuns
     * @param {string} expr
     * @param {number} flags
     * @param {function(FileStat,Error):void} callback
     */
    stat(efuns, expr, flags, callback) {
        return this.createFileRequest(expr, req => {
            return req.securityManager.validReadFile(efuns, req.fullPath) ?
                req.filesystem.stat(req.relativePath, flags, callback) :
                req.securityManager.denied('stat', req.fullPath);
        });
    }

    /**
     * Converts a real path into a virtual MUD path.
     * @param {string} expr The absolute file path to translate.
     * @returns {string} The virtual MUD path or false if not in the virtual filesystem.
     */
    toMudPath(expr) {
        let fsn = Object.keys(this.fileSystems);
        for (let i = 0; i < fsn.length; i++) {
            let fso = this.fileSystems[fsn[i]],
                result = fso.getVirtualPath(expr);
            if (result) return fsn[i] + result;
        }
        return false;
    }

    /**
     * Translates a virtual path into an absolute path (if filesystem supported)
     * @param {string} dir The virtual directory to translate.
     * @returns {string} The absolute path.
     */
    toRealPath(expr) {
        return this.createFileRequest(expr, req => {
            return req.filesystem.getRealPath(req.relativePath);
        });
    }

    /**
     * 
     * @param {any} efuns
     * @param {any} expr
     * @param {any} content
     * @param {any} callback
     */
    writeFile(efuns, expr, content, callback) {
        return this.createFileRequest(expr, req => {
            return req.securityManager.validWriteFile(efuns, req.fullPath) ?
                req.filesystem.writeFile(req.relativePath, content, callback) :
                req.securityManager.denied('write', req.fullPath);
        });
    }
}

module.exports = FileManager;
