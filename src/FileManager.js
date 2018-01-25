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
    MXC = require('./MXC'),
    path = require('path'),
    fs = require('fs');

// Global enum-type object for directory listing flags
mudglobal.GetDirFlags = {
    None: 0,
    Files: 1 << 1,
    Defaults: 1 << 1 | 1 << 2 | 1 << 6,
    Details: 1 | 1 << 3,
    Dirs: 1 << 2,
    ImplicitDirs: 1 << 6,
    Perms: 1 << 3,
    System: 1 << 5,
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

/**
 * Contains all of the information needed to perform a filesystem operation.
 */
class FileSystemRequest {
    /**
     * Creates a filesystem request.
     * @param {FileSystem} fileSystem
     * @param {number} flags
     * @param {string} op
     * @param {string} expr
     * @param {string} relPath
     * @param {FileSystemStat} fss
     */
    constructor(fileSystem, flags, op, expr, relPath, fss) {
        /** @type {string} */
        this.fileName = '';

        /** @type {string} */
        this.fullPath = '';

        /** @type {string} */
        this.relativePath = '';

        /** @type {FileSystem} */
        this.fileSystem = fileSystem;

        /** @type {number} */
        this.flags = typeof flags === 'number' ? flags : 0;

        /** @type {string} */
        this.pathFull = '';

        /** @type {string} */
        this.pathRel = '';

        /** @type {boolean} */
        this.resolved = false;

        /** @type {string} */
        this.op = op || 'unknown';

        /** @type {FileSecurity} */
        this.securityManager = fileSystem.securityManager;

        if (fss.exists) {
            this.resolved = true;
            if (!fss.isDirectory) {
                let dir = expr.slice(0, expr.lastIndexOf('/')),
                    rel = relPath.slice(0, relPath.lastIndexOf('/'));

                this.fileName = expr.slice(dir.length + 1);
                this.fullPath = expr;
                this.relativePath = relPath;
                this.pathFull = dir;
                this.pathRel = rel;
            }
            else {
                this.fileName = '';
                this.fullPath = expr;
                this.relativePath = relPath;
                this.pathFull = expr + (expr.endsWith('/') ? '' : '/');
                this.pathRel = relPath + (relPath.endsWith('/') ? '' : '/');
            }
        }
        else {
            if (!expr.endsWith('/')) {
                let dir = expr.slice(0, expr.lastIndexOf('/')),
                    rel = relPath.slice(0, relPath.lastIndexOf('/'));

                this.fileName = expr.slice(dir.length + 1);
                this.fullPath = expr;
                this.relativePath = relPath;
                this.pathFull = dir + (dir.endsWith('/') ? '' : '/');
                this.pathRel = rel + (rel.endsWith('/') ? '' : '/');
            }
            else {
                this.fileName = '';
                this.fullPath = expr;
                this.relativePath = relPath;
                this.pathFull = expr;
                this.pathRel = relPath;
            }
        }
    }

    toString() {
        return `${this.op}:${this.fullPath}`;
    }
}

/**
 * The file manager object receives external requests, creates internal requests,
 * and dispatches those requests to the file and security systems.  It then sends
 * the results back to the user (usually an efuns proxy instance).
 */
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

    /**
     * 
     * @param {any} expr
     * @param {any} content
     * @param {any} callback
     */
    appendFile(expr, content, callback) {
        return this.createFileRequest('appendFile', expr, typeof callback === 'function', 0, req => {

        });
    }

    /**
     * Not needed by default file manager.
     */
    assertValid() {
        return this;
    }

    /**
     * Returns the filesystem for the specified path.
     * @param {string} expr The path being requested.
     * @param {boolean} isAsync Indicates the operation being performed is async or not.
     * @param {function(FileSystemRequest):any} callback An optional callback.
     * @returns {FileSystemRequest} The filesystem supporting the specified path.
     */
    createFileRequest(op, expr, isAsync, flags, callback) {
        let parts = expr.split('/'),
            fileSystem = this.fileSystems['/'] || false,
            relParts = [], relPath = expr.slice(1),
            dir = '/';

        if (typeof callback !== 'function')
            throw new Error('createFileRequest called without callback');

        while (parts.length) {
            dir = parts.join('/');
            if (dir in this.fileSystems) {
                relPath = relParts.join('/');
                fileSystem = this.fileSystems[dir];
                break;
            }
            relParts.unshift(parts.pop());
        }
        if (!fileSystem)
            throw new Error('Fatal: Could not locate filesystem');

        if (isAsync) {
            if (typeof callback !== 'function')
                throw new Error('Async request must provide callback for createFileRequest()');

            return fileSystem.stat(relPath, MXC.awaiter((fss, err) => {
                let resultAsync = new FileSystemRequest(fileSystem, flags, op, expr, relPath, fss);
                return callback(resultAsync);
            }, `createFileRequest:${op}:${expr}`));
        }
        else {
            let mxc = driver.getContext(false, init => init.note = `createFileRequest:${op}:${expr}`);
            try {
                mxc.restore();
                let fss = fileSystem.stat(relPath);
                let resultSync = new FileSystemRequest(fileSystem, flags, '', expr, relPath, fss);
                try {
                    return callback(resultSync);
                }
                catch (err) {
                    throw driver.cleanError(err);
                }
            }
            finally {
                mxc.release();
            }
        }
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

    /**
     *
     * @param {EFUNProxy} efuns
     * @param {string} expr
     * @param {string} content
     * @param {function(boolean,Error):void} callback
     */
    appendFile(efuns, expr, content, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = false;
        }
        return this.createFileRequest('appendFile', expr, typeof callback !== 'undefined', 0, req => {
            return req.securityManager.validAppendFile(efuns, req) ?
                req.fileSystem.appendFile(req, content, callback) :
                req.securityManager.denied('appendFile', req.fullPath);
        });
    }

    /**
     * Create a directory in the MUD filesystem.
     * @param {EFUNProxy} efuns The object creating the directory.
     * @param {string} expr The path to create.
     * @param {MkdirFlags} options Optional flags to pass to the mkdir method.
     * @param {function(boolean,Error):void} callback A callback to fire if async
     */
    createDirectory(efuns, expr, options, callback) {
        return this.createFileRequest('createDirectory', expr, typeof callback === 'function', options.flags, req => {
            return req.securityManager.validCreateDirectory(efuns, req) ?
                req.fileSystem.createDirectory(req, options, callback) :
                req.securityManager.denied('createDirectory', req.fullPath);
        });
    }

    /**
     * Delete/unlink a file from the filesystem.
     * @param {EFUNProxy} efuns The object requesting the deletion.
     * @param {string} expr The path expression to remove.
     * @param {callback(boolean, Error):void} callback Callback for async deletion.
     */
    deleteFile(efuns, expr, callback) {
        return this.createFileRequest('deleteFile', expr, typeof callback === 'function', 0, req => {
            return req.securityManager.validDeleteFile(efuns, req) ?
                req.fileSystem.deleteFile(req, callback) :
                req.securityManager.denied('delete', req.fullPath);
        });
    }

    /**
     * Iterate over the filesystems and perform an action for each.
     * @param {function(FileSystem,string):any[]} callback
     * @returns {any[]} The result of all the actions taken, one element for each filesystem.
     */
    eachFileSystem(callback) {
        return Object.keys(this.fileSystems)
            .map(id => callback(this.fileSystems[id], id));
    }

    /**
     * Check to see if the given expression is a directory,
     * @param {EFUNProxy} efuns The external proxy checking the directory.
     * @param {string} expr The path expression to evaluate.
     * @param {function(boolean,Error):void} callback Callback receives a boolean value indicating True if the expression is a directory.
     * @returns {boolean} True if the expression is a directory.
     */
    isDirectory(efuns, expr, callback) {
        return this.createFileRequest('isDirectory', expr, typeof callback === 'function', 0, req => {
            return req.securityManager.isDirectory(efuns, req, callback);
        });
    }

    /**
     * Check to see if the given expression is a file,
     * @param {EFUNProxy} efuns The external proxy checking the file.
     * @param {string} expr The path expression to evaluate.
     * @param {function(boolean,Error):void} callback Callback receives a boolean value indicating True if the expression is a file.
     * @returns {boolean} True if the expression is a file.
     */
    isFile(efuns, expr, callback) {
        return this.createFileRequest('isFile', expr, typeof callback === 'function', 0, req => {
            return req.securityManager.isFile(efuns, req, callback);
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
        return this.createFileRequest('loadObject', mudpath, typeof callback === 'function', 0, req => {
            return req.securityManager.validLoadObject(efuns, req) ?
                req.fileSystem.loadObject(req, args, callback) :
                req.securityManager.denied('load', req.fullPath);
        });
    }

    /**
     * Read files from a directory.
     * @param {EFUNProxy} efuns The object requesting the directory listing.
     * @param {string} expr The MUD virtual path to read from.
     * @param {number} flags Flags indicating request for additional details.
     * @param {function(string[], Error):void} callback A callback for asyncronous reading.
     */
    readDirectory(efuns, expr, flags, callback) {
        return this.createFileRequest('readDirectory', expr, typeof callback === 'function', flags, req => {
            return req.securityManager.readDirectory(efuns, req, callback);
        });
    }

    /**
     * Reads a file from the filesystem.
     * @param {EFUNProxy} efuns The efuns instance making the call.
     * @param {string} expr The file to try and read.
     * @param {function=} callback An optional callback for async mode.
     */
    readFile(efuns, expr, callback) {
        return this.createFileRequest('readFile', expr, typeof callback === 'function', 0, req => {
            return req.securityManager.readFile(efuns, req, callback);
        });
    }

    /**
     * Read structured data from the specified location.
     * @param {EFUNProxy} efuns The efuns instance making the call.
     * @param {string} expr The JSON file being read.
     * @param {function=} callback An optional callback for async mode.
     */
    readJsonFile(efuns, expr, callback) {
        return this.createFileRequest('readJsonFile', expr, typeof callback === 'function', 0, req => {
            return req.securityManager.validReadFile(efuns, req) ?
                req.fileSystem.readJsonFile(req, callback) :
                req.securityManager.denied('read', req.fullPath);
        });
    }

    reloadObject(efuns, expr, args, callback) {
        return this.createFileRequest('reloadObject', expr, typeof callback === 'function', 1, req => {
            return req.securityManager.validLoadObject(efuns, req) ?
                req.fileSystem.loadObject(req, args, callback) :
                req.securityManager.denied('load', req.fullPath);
        })
    }

    /**
     * Remove a directory from the filesystem.
     * @param {EFUNProxy} efuns
     * @param {string} expr
     * @param {any} flags
     * @param {function(boolean,Error):void} callback
     */
    removeDirectory(efuns, expr, flags, callback) {
        return this.createFileRequest('removeDirectory', expr, typeof callback === 'function', flags, req => {
            return req.securityManager.validDeleteDirectory(efuns, req) ?
                req.fileSystem.deleteDirectory(req, flags, callback) :
                req.securityManager.denied('removeDirectory', req.fullPath);
        });
    }

    /**
     * Stat a filesystem expression
     * @param {EFUNProxy} efuns
     * @param {string} expr
     * @param {number} flags
     * @param {function(FileSystemStat,Error):void} callback
     */
    stat(efuns, expr, flags, callback) {
        return this.createFileRequest('stat', expr, typeof callback === 'function', flags, req => {
            return req.securityManager.validReadFile(efuns, req.fullPath) ?
                req.fileSystem.stat(req, flags, callback) :
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
        return this.createFileRequest('toRealPath', expr, typeof callback === 'function', 0, req => {
            return req.fileSystem.getRealPath(req);
        });
    }

    /**
     *
     * @param {EFUNProxy} efuns
     * @param {string} expr
     * @param {string|Buffer} content
     * @param {function(boolean,Error)} callback
     */
    writeFile(efuns, expr, content, callback) {
        return this.createFileRequest('writeFile', expr, typeof callback === 'function', 0, req => {
            return req.securityManager.validWriteFile(efuns, req) ?
                req.fileSystem.writeFile(req, content, callback) :
                req.securityManager.denied('write', req.fullPath);
        });
    }
}

module.exports = FileManager;
