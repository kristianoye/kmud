/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides a uniform API for accessing the underlying MUD
 * filesystems.
 * 
 * All filesystems must provide the following operations (async and optional sync):
 *   Directories:
 *     - Read Directory Contents
 *     - Is Directory?
 *     - MkDir
 *     - RmDir
 *   Files:
 *     - Read File
 *     - Write File
 *     - Is File?
 *     - Remove File
 *   JSON:
 *     - Read
 *     - Write
 */
const
    MUDEventEmitter = require('./MUDEventEmitter'),
    { MudlibFileMount } = require('./config/MudlibFileSystem'),
    path = require('path');

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

var
    /** @type {FileManager} */
    FileManagerInstance = false;

/**
 * Contains all of the information needed to perform a filesystem operation.
 */
class FileSystemRequest {
    /**
     * Creates a filesystem request.
     * @param {{ fs: FileSystem, flags: number|string, op: string, expr: string, relPath: string, isAsync: boolean, efuns: EFUNProxy }} data The data to construct the request with
     */
    constructor(data) {
        this.async = data.isAsync;

        this.expr = data.expr;

        this.efuns = data.efuns;

        /** @type {string} */
        this.fileName = '';

        /** @type {string} */
        this.fullPath = '';

        /** @type {string} */
        this.relativePath = '';

        /** @type {FileSystem} */
        this.fileSystem = data.fs;

        /** @type {number} */
        this.flags = typeof data.flags === 'string' ? data.flags :
            typeof data.flags === 'number' ? data.flags : 0;

        /** @type {FileSystemStat} */
        this.parent = null;

        /** @type {string} */
        this.pathFull = '';

        /** @type {string} */
        this.pathRel = '';

        /** @type {boolean} */
        this.resolved = false;

        /** @type {string} */
        this.op = data.op || 'unknown';

        /** @type {FileSecurity} */
        this.securityManager = data.fs.securityManager;

        let expr = data.expr, relPath = data.relPath;
        //  Best guess for now
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

    clone(init) {
        let c = new FileSystemRequest({
            fs: this.fileSystem,
            flags: this.flags,
            op: this.op,
            expr: this.expr,
            relPath: this.relativePath,
            efuns: this.efuns
        });
        init(c);
        return c;
    }

    deny() {
        let procName = this.op.slice(0, 1).toLowerCase() +
            this.op.slice(1) + (this.async ? 'Async' : 'Sync');
        return this.securityManager.denied(procName, this.fullPath);
    }

    toString() {
        return `${this.op}:${this.fullPath}`;
    }

    valid(method) {
        if (method && !method.startsWith('valid'))
            method = 'valid' + method;
        let checkMethod = method || `valid${this.op}`;
        if (typeof this.securityManager[checkMethod] !== 'function')
            throw new Error(`Security method ${checkMethod} not found!`);
        let result = this.securityManager[checkMethod](this.efuns, this.fullPath);
        return result;
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
     * Not needed by default file manager.
     */
    assertValid() {
        return this;
    }

    /**
     * Clone an object into existance.
     * @param {EFUNProxy} efuns The object requesting the clone
     * @param {string} expr The module to clone
     * @param {any} args Constructor args for clone
     * @returns {MUDWrapper} The wrapped instance.
     */
    cloneObjectSync(efuns, expr, args) {
        let req = this.createFileRequest('cloneObject', expr, false, 0, null, efuns);
        if (!req.valid('LoadObject'))
            return req.deny();
        else
            return req.fileSystem.cloneObjectSync(req.relativePath, args || []);
    }

    /**
     * Create a request that describes the current operation.
     * 
     * @param {string} op The name of the file operation
     * @param {string} expr THe filename expression being operated on
     * @param {boolean} isAsync A flag indicating whether this is an async operation
     * @param {string|number} flags Any numeric flags associated with the operation
     * @param {function(): any} callback A defunct callback
     * @param {EFUNProxy} efuns The efun proxy that made the request.
     * @returns {FileSystemRequest} The request to be fulfilled.
     */
    createFileRequest(op, expr, isAsync, flags, callback, efuns) {
        let parts = expr.split('/'),
            fileSystem = this.fileSystems['/'] || false,
            relParts = [], relPath = expr.slice(1),
            dir = '/';

        while (parts.length) {
            dir = parts.join('/');
            if (dir in this.fileSystems) {
                relPath = relParts.join('/');
                fileSystem = this.fileSystems[dir];
                break;
            }
            relParts.unshift(parts.pop());
        }
        if (!efuns) {
            1;
        }

        if (!fileSystem)
            throw new Error('Fatal: Could not locate filesystem');

        if (callback)
            throw new Error('createFileRequest with callback is no longer supported');

        return new FileSystemRequest({
            fs: fileSystem,
            flags: flags,
            op: op || '',
            expr,
            relPath,
            isAsync: isAsync === true,
            efuns
        });
    }

    /**
     * Create the specified filesystem.
     * @param {MudlibFileMount} fsconfig The filesystem to mount.
     */
    async createFileSystem(fsconfig) {
        let fileSystemType = require(path.join(__dirname, fsconfig.type)),
            securityManagerType = require(path.join(__dirname, fsconfig.securityManager)),
            fileSystem = this.fileSystems[fsconfig.mountPoint] = new fileSystemType(this, fsconfig.options, fsconfig.mountPoint),
            securityManager = new securityManagerType(this, fileSystem, fsconfig.securityManagerOptions);
        return fileSystem;
    }

    /**
     * Create a directory asynchronously
     * @param {any} efuns
     * @param {any} expr
     * @param {any} flags
     */
    async createDirectoryAsync(efuns, expr, flags = 0) {
        let req = this.createFileRequest('CreateDirectory', expr, false, flags, null, efuns);
        if (!req.valid())
            return req.deny();
        else
            return await req.fileSystem.createDirectoryAsync(req.relativePath, req.flags);
    }

    /**
     * Create a directory in the MUD filesystem.
     * @param {EFUNProxy} efuns The object creating the directory.
     * @param {string} expr The path to create.
     * @param {number} options Optional flags to pass to the mkdir method.
     * @returns {boolean} True on success.
     */
    createDirectorySync(efuns, expr, options) {
        let req = this.createFileRequest('CreateDirectory', expr, false, options.flags, null, efuns);
        if (!req.valid())
            return req.deny();
        else
            return req.fileSystem.createDirectorySync(req.relativePath, req.flags);
    }

    /**
     * Generate a dummy stat.
     * @param {Error} err An error that occurred.
     */
    createDummyStats(err = false, fullPath = '') {
            let dt = new Date(0),
                alwaysFalse = () => false;

            return {
                atime: dt,
                atimeMs: dt.getTime(),
                birthtime: dt,
                birthtimeMs: dt.getTime(),
                blksize: 4096,
                blocks: 0,
                ctime: dt,
                ctimeMs: dt.getTime(),
                dev: -1,
                error: err || new Error('Unknown error'),
                exists: false,
                gid: -1,
                ino: -1,
                nlink: -1,
                uid: -1,
                mode: -1,
                mtime: dt,
                mtimeMs: dt.getTime(),
                path: fullPath || '',
                size: -1,
                rdev: -1,
                isBlockDevice: alwaysFalse,
                isCharacterDevice: alwaysFalse,
                isDirectory: alwaysFalse,
                isFIFO: alwaysFalse,
                isFile: alwaysFalse,
                isSocket: alwaysFalse,
                isSymbolicLink: alwaysFalse
            };
    }

    /**
     * Remove a directory from the filesystem.
     * @param {EFUNProxy} efuns The object requesting the deletion.
     * @param {string} expr The directory to remove.
     * @param {object} options Any additional options.
     */
    deleteDirectoryAsync(efuns, expr, options) {
        let req = this.createFileRequest('DeleteDirectory', expr, false, options.flags, null, efuns);
        if (!req.valid())
            return req.deny();
        else
            return req.fileSystem.deleteDirectoryAsync(req.relativePath, req.flags);
    }

    /**
     * Remove a directory from the filesystem.
     * @param {EFUNProxy} efuns The object requesting the deletion.
     * @param {string} expr The directory to remove.
     * @param {object} options Any additional options.
     */
    deleteDirectorySync(efuns, expr, options) {
        let req = this.createFileRequest('DeleteDirectory', expr, false, options.flags, null, efuns);
        if (!req.valid())
            return req.deny();
        else
            return req.fileSystem.deleteDirectorySync(req.relativePath, req.flags);
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


    isDirectoryAsync(efuns, expr) {
        let req = this.createFileRequest('isDirectory', expr, true, 0, null, efuns);

        return new Promise((resolve, reject) => {
            if (!req.valid('validReadDirectory'))
                reject(req.deny());
            else
                req.fileSystem.isDirectoryAsync(req.relativePath)
                    .then(r => resolve(r))
                    .catch(e => reject(e));
        });
    }

    /**
     * Check to see if the given expression is a directory,
     * @param {EFUNProxy} efuns The external proxy checking the directory.
     * @param {string} expr The path expression to evaluate.
     * @param {function(boolean,Error):void} callback Callback receives a boolean value indicating True if the expression is a directory.
     * @returns {boolean} True if the expression is a directory.
     */
    isDirectorySync(efuns, expr) {
        let req = this.createFileRequest('isDirectory', expr, false, 0, null, efuns);
        if (req.valid('validReadDirectory'))
            return req.deny();
        else
            return req.fileSystem.isDirectorySync(req.relativePath);
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
     * @param {string} expr Information about what is being requested.
     * @param {any} args Data to pass to the constructor.
     * @param {number} flags Flags to control the operation
     * @returns {MUDObject} The loaded object... hopefully
     */
    async loadObjectAsync(efuns, expr, args, flags = 0) {
        let req = this.createFileRequest('LoadObject', expr, false, flags, null, efuns);
        if (!req.valid())
            return req.deny();
        else
            return await req.fileSystem.loadObjectAsync(req.relativePath, args || [], req.flags);
    }

    /**
     * Load an object from disk.
     * @param {EFUNProxy} efuns The efuns instance making the call.
     * @param {string} expr Information about what is being requested.
     * @param {any} args Data to pass to the constructor.
     * @param {number} flags Flags to control the operation
     * @returns {MUDObject} The loaded object... hopefully
     */
    loadObjectSync(efuns, expr, args, flags = 0) {
        let req = this.createFileRequest('LoadObject', expr, false, flags, null, efuns);
        if (!req.valid())
            return req.deny();
        else
            return req.fileSystem.loadObjectSync(req.relativePath, args || [], req.flags);
    }

    /**
     * Move or rename a file
     * @param {EFUNProxy} efuns The object requesting the move.
     * @param {string} source The file to be moved.
     * @param {string} destination The destination to move the file to.
     * @param {MUDFS.MoveOptions} options Options related to the move operation.
     * @param {function(boolean,Error):void} callback Optional callback for async mode.
     */
    movePath(efuns, source, destination, options, callback) {
        let reqLeft = this.createFileRequest('moveFile', source, typeof callback !== 'undefined', options.flags);
        let reqRight = this.createFileRequest('moveRight', destination, typeof callback !== 'undefined', options.flags);
    }

    readDirectoryAsync(efuns, expr, flags, callback) {
        let req = this.createFileRequest('ReadDirectory', expr, false, flags, null, efuns);
        if (!req.valid())
            return req.deny();
        else
            return req.fileSystem.readDirectoryAsync(req.pathRel, req.fileName, req.flags);
    }

    readDirectorySync(efuns, expr, flags) {
        let req = this.createFileRequest('ReadDirectory', expr, false, flags, null, efuns);
        if (!req.valid())
            return req.deny();
        else
            return req.fileSystem.readDirectorySync(req.pathRel, req.fileName, req.flags);
    }

    /**
     * Reads a file from the filesystem.
     * @param {EFUNProxy} efuns The efuns instance making the call.
     * @param {string} expr The file to try and read.
     * @returns {string} The content from the file.
     */
    readFileSync(efuns, expr) {
        let req = this.createFileRequest('ReadFile', expr, false, 0, null, efuns);
        if (!req.valid())
            return req.deny();
        else
            return req.fileSystem.readFileSync(req.relativePath);
    }

    /**
     * Read structured data from the specified location.
     * @param {EFUNProxy} efuns The efuns instance making the call.
     * @param {string} expr The JSON file being read.
     * @param {function=} callback An optional callback for async mode.
     */
    async readJsonFileAsync(efuns, expr) {
        let req = this.createFileRequest('readJsonFile', expr, false, 0, null, efuns);
        if (!req.valid('validReadFile'))
            return req.deny();
        else
            return await req.fileSystem.readJsonFileAsync(req.fullPath);
    }

    /**
     * Read structured data from the specified location.
     * @param {EFUNProxy} efuns The efuns instance making the call.
     * @param {string} expr The JSON file being read.
     * @param {function=} callback An optional callback for async mode.
     */
    readJsonFileSync(efuns, expr) {
        let req = this.createFileRequest('readJsonFile', expr, false, 0, null, efuns);
        if (!req.valid('validReadFile'))
            return req.deny();
        else
            return req.fileSystem.readJsonFileSync(req.fullPath);
    }

    statAsync(efuns, expr, flags) {
        let req = this.createFileRequest('stat', expr, false, flags, null, efuns);
        if (!req.securityManager.validReadFile(efuns, req.fullPath))
            return req.deny();
        else
            return req.fileSystem.statAsync(req.relativePath, req.flags);
    }

    /**
     * Stat a filesystem expression
     * @param {EFUNProxy} efuns The calling efuns method
     * @param {string} expr The expression to stat
     * @param {number} flags Flags to control the behavior
     */
    statSync(efuns, expr, flags) {
        let req = this.createFileRequest('stat', expr, false, flags, null, efuns);
        if (!req.securityManager.validReadFile(efuns, req.fullPath))
            return req.deny();
        else
            return req.fileSystem.statSync(req.relativePath, req.flags);
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
     * @param {EFUNProxy} efuns The efuns instance that called this
     * @param {string} expr The virtual directory to translate.
     * @returns {string} The absolute path.
     */
    toRealPath(efuns, expr) {
        let req = this.createFileRequest('toRealPath', expr, typeof callback === 'function', 0, null,  efuns);
        return req.fileSystem.getRealPath(req.relativePath);
    }

    /**
     * Write to a file asyncronously.
     * @param {EFUNProxy} efuns The object performing the write operation.
     * @param {string} expr The file to write to.
     * @param {string|Buffer} content The content to write to file.
     * @param {string} flags Flags controlling the operation.
     * @param {string} encoding The optional encoding to use
     * @returns {Promise<boolean>} The promise for the operation.
     */
    async writeFileAsync(efuns, expr, content, flags, encoding) {
        let req = this.createFileRequest('WriteFile', expr, true, flags || 'w', efuns);
        return new Promise((resolve, reject) => {
            try {
                if (!req.valid())
                    reject(req.deny());
                else
                    resolve(req.fileSystem.writeFileAsync(req.relativePath, content, req.flags, encoding));
            }
            catch (err) {
                reject(err);
            }
        });
    }

    writeFileSync(efuns, expr, content, flags) {
        let req = this.createFileRequest('WriteFile', expr, false, flags, null, efuns);
        if (!req.valid())
            return req.deny();
        else
            return req.fileSystem.writeFileSync(req.relativePath, content, req.flags);
    }
}

module.exports = FileManager;
