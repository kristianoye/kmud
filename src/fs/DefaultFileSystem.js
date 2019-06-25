/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    { FileSystem, FileSystemStat } = require('../FileSystem'),
    FileManager = require('../FileManager'),
    async = require('async'),
    path = require('path'),
    fs = require('fs');

class DefaultFileSystem extends FileSystem {
    /**
     * 
     * @param {FileManager} fm The filemanager instance
     * @param {Object.<string,any>} options Dictionary containing options.
     * @param {string} mountPoint The point where the filesystem mounts.
     */
    constructor(fm, options, mountPoint) {
        super(fm, options, mountPoint);

        this.mountPoint = mountPoint;

        /** @type {number} */
        this.asyncReaderLimit = options.asyncReaderLimit > 0 ? options.asyncReaderLimit : 10;

        /** @type {string} */
        this.root = path.resolve(fm.mudlibRoot, options.path);

        /** @type {number} */
        this.flags = FileSystem.FS_ASYNC |
            FileSystem.FS_SYNC |
            FileSystem.FS_DIRECTORIES |
            FileSystem.FS_OBJECTS | 
            FileSystem.FS_WILDCARDS;

        if (options.readOnly === true)
            this.flags |= FileSystem.FS_READONLY;

        /** @type {boolean} */
        this.autoStripBOM = typeof options.autoStripBOM === 'boolean' ?
            options.autoStripBOM : true;

        switch (path.sep) {
            case '\\':
                this.normalizer = /\\/g;
                break;
            default:
                this.normalizer = false;
                break;
        }

        /** @type {RegExp} */
        this.translator = new RegExp(/\//g);

        /** @type {string} */
        this.type = 'MUDFS';
    }

    /**
     * Convert the virtual path to a real path.
     * @param {string} req The file expression to convert.
     * @returns {string} The absolute filesystem path.
     */
    getRealPath(req) {
        return path.resolve(this.root, req);
    }

    /**
     * Appends content to a file syncronously.
     * @param {FileSystemRequest} req The filesystem request.
     * @param {string|Buffer} content The content to write to file.
     * @returns {string} The absolute path to the file.
     */
    appendFileSync(req, content) {
        return this.translatePath(req.relativePath, fullPath => {
            let stat = this.statSync(fullPath);
            if (stat.isDirectory)
                throw new Error(`appendFile: ${req.fullPath} is a directory`);
            return fs.writeFileSync(fullPath, content, {
                encoding: this.encoding || 'utf8',
                flag: 'a'
            });
        });
    }

    /**
     * 
     * @param {FileSystemRequest} req The filesystem request
     * @param {object} args Constructor args
     * @param {function(MUDObject,Error):void} callback The callback to receive the result
     */
    cloneObjectAsync(req, args, callback) {
        if (!this.assertAsync(FileSystem.FS_ASYNC))
            callback(false, new Error('Filesystem does not support async'));
    }

    /**
     * Clone an object syncronously.
     * @param {string} req The request to clone an object.
     * @param {any[]} args Constructor args to pass to the new object.
     * @returns {MUDObject} The newly cloned object.
     */
    cloneObjectSync(req, args) {
        if (!this.assert(FileSystem.FS_SYNC))
            return false;
        let fullPath = path.posix.join(this.mountPoint, '/',  req),
            { file, type, instance } = driver.efuns.parsePath(fullPath),
            module = driver.cache.get(file);

        if (instance > 0)
            throw new Error(`cloneObject() cannot request a specific instance ID`);

        let ecc = driver.getExecution();
        try {
            if (!module || !module.loaded) {
                module = driver.compiler.compileObject({ file, args });
            }
            if (module) {
                return module.createInstance(file, type, args);
            }
        }
        catch (err) {
            logger.log('cloneObjectSync() error:', err.message);
        }
        finally {
            delete ecc.newContext;
        }
        return false;
    }

    /**
     * Check to see if the expression contains wildcards.
     * @param {FileSystemRequest} req The request to check
     * @returns {boolean} True if the filename contains wildcards.
     */
    containsWildcards(req) {
        return req.fileName && req.fileName.match(/[\*\?]+/);
    }


    async createDirectoryAsync(expr, flags) {
        let fullPath = this.translatePath(expr);
        let parts = path.relative(this.root, fullPath).split(path.sep),
            ensure = (flags & MUDFS.MkdirFlags.EnsurePath) === MUDFS.MkdirFlags.EnsurePath;
        let mkdir = async (dir) => {
            return new Promise((resolve) => {
                try {
                    fs.mkdir(dir, err => {
                        if (err) {
                            switch (err.code) {

                                default:
                                    resolve(err);
                                    break;
                            }
                        }
                        else resolve(true);
                    });
                }
                catch (err) {
                    resolve(err);
                }
            });
        };

        for (let i = 0, max = parts.length; i < max; i++) {
            let dir = path.join(this.root, path.sep, ...parts.slice(0, i + 1)),
                stat = await this.statAsync(dir);

            if (stat.exists && !stat.isDirectory())
                return false;

            if (i + 1 === max) {
                if (stat.exists)
                    return true;

                let result = await mkdir(dir);

                if (result === true)
                    return true;
                else
                    throw result;
            }
            else if (stat.isDirectory())
                continue;

            else if (!ensure)
                return false;

            else {
                let result = await mkdir(dir);
                if (result !== true) throw result;
            }
        }
    }

    /**
     * Create a directory syncronously.
     * @param {string} expr The directory expression to create.
     * @param {number} flags Additional options for createDirectory.
     * @returns {string} The full path to the newly created directory.
     */
    createDirectorySync(expr, flags) {
        let fullPath = this.translatePath(expr);
        let parts = path.relative(this.root, fullPath).split(path.sep),
            ensure = (flags & MUDFS.MkdirFlags.EnsurePath) === MUDFS.MkdirFlags.EnsurePath;

        for (let i = 0, max = parts.length; i < max; i++) {
            let dir = path.join(this.root, path.sep, ...parts.slice(0, i)),
                stat = this.statSync(dir);

            if (stat && stat.exists) {
                if (!ensure) return false;
            }
            else if (i + 1 === max) {
                fs.mkdirSync(dir);
                return true;
            }
            else if (!ensure)
                return false;
            else
                fs.mkdirSync(dir);
        }
        return true;
    }

    /**
     * Create a strongly-typed filesystem stat object.
     * @param {function(): FileSystemStat|object} statFunc
     * @returns {FileSystemStat}
     */
    createStat(statFunc) {
        try {
            if (typeof statFunc === 'function') {
                let stat = statFunc();

                if (typeof stat.isDirectory === 'function')
                    stat.isDirectory = stat.isDirectory();
                if (typeof stat.isFile === 'function')
                    stat.isFile = stat.isFile();
                if (!stat.exists && (stat.atime > 0 || stat.isDirectory || stat.isFile))
                    stat.exists = true;
                return Object.freeze(new FileSystemStat(stat, undefined, this.mountPoint));
            }
            else if (typeof statFunc === 'object') {
                if (typeof statFunc.isDirectory === 'function')
                    statFunc.isDirectory = statFunc.isDirectory();
                if (typeof statFunc.isFile === 'function')
                    stat.isFile = stat.isFile();
                if (!stat.exists && (stat.atime > 0 || stat.isDirectory || stat.isFile))
                    stat.exists = true;
                return Object.freeze(new FileSystemStat(stat, undefined, this.mountPoint));
            }
            else
                throw new Error(`Bad argument 1 to createStat; Expected function or object, got ${typeof statFunc}`);
        }
        catch (err) {
            Object.freeze(FileSystemStat.create({
                error: err,
                exists: false,
                isDirectory: false,
                isFile: false,
                parent: null,
                size: -3
            }));
        }
    }

    /**
     * Translate an absolute path back into a virtual path.
     * @param {string} expr The absolute path to translate.
     * @returns {string|false} The virtual path if the expression exists in this filesystem or false if not.
     */
    getVirtualPath(expr) {
        if (expr.startsWith(this.root)) {
            let result = path.relative(this.root, expr);
            if (this.normalizer) {
                result = result.replace(this.normalizer, '/');
            }
            return result;
        }
        return false;
    }

    /**
     * Check to see if the expression is a directory.
     * @param {string} relativePath The filesystem request.
     * @returns {void} Nothing for async
     */
    isDirectoryAsync(relativePath) {
        let fullPath = this.translatePath(relativePath);
        return new Promise((resolve, reject) => {
            try {
                fs.stat(fullPath, (err, stat) => {
                    if (err)
                        reject(err);
                    else
                        resolve(stat.isDirectory());
                });
            }
            catch (err) {
                resolve(false);
            }
        });
    }

    /**
     * Check to see if the expression is a directory.
     * @param {string} relativePath The filesystem request.
     * @returns {boolean} True or false depending on whether the expression is a directory.
     */
    isDirectorySync(relativePath) {
        let absPath = this.translatePath(relativePath);

        try {
            let stat = fs.statSync(absPath);
            return stat && stat.isDirectory();
        }
        catch (e) {
        }
        return false;
    }

    /**
     * @param {FileSystemRequest} req The filesystem request.
     * @param {function(boolean,Error):void} callback
     * @returns {void} Nothing for async.
     */
    isFileAsync(req, callback) {
        return this.translatePath(req.relativePath, fullPath => {
            return this.statAsync(fullPath, (stat, err) => {
                return callback(stat.isFile, err);
            });
        });
    }

    /**
     * @param {FileSystemRequest} req The filesystem request.
     * @returns {boolean} True or false depending on if expression is a file.
     */
    isFileSync(req) {
        return this.translatePath(req.relativePath, fullPath => {
            let stat = this.statSync(fullPath);
            return stat.isFile;
        })
    }

    loadObjectAsync(req, args, callback) {
        throw new Error('Not implemented');
    }

    /**
     * Loads an object instance from storage.
     * @param {string} expr The path split into parts.
     * @param {any} args Optional constructor args.
     * @param {number} flags Optional flags to change the behavior of the method.
     * @returns {MUDWrapper} Returns the MUD object wrapper if successful.
     */
    loadObjectSync(expr, args, flags) {
        let fullPath = path.posix.join(this.mountPoint, '/', expr),
            parts = driver.efuns.parsePath(fullPath),
            module = driver.cache.get(parts.file),
            forceReload = !module || flags & 1 === 1;

        if (forceReload) {
            module = driver.compiler.compileObject({
                args,
                file: parts.file,
                reload: !!module
            });
            if (!module)
                throw new Error(`Failed to load module ${fullPath}`);
        }
        return module.getInstanceWrapper(parts);
    }

    readDirectoryAsync(relativePath, fileName, flags) {
        return new Promise(resolve => {
            try {
                let fullPath = this.translatePath(relativePath), isAbs = relativePath.startsWith(this.root);
                let showFullPath = (flags & MUDFS.GetDirFlags.FullPath) === MUDFS.GetDirFlags.FullPath,
                    details = (flags & MUDFS.GetDirFlags.Details) === MUDFS.GetDirFlags.Details,
                    pattern = fileName &&
                        new RegExp('^' + fileName
                            .replace(/\./g, '\\.')
                            .replace(/\?/g, '.')
                            .replace(/\*/g, '.+') + '$');

                if (flags & MUDFS.GetDirFlags.ImplicitDirs && !fullPath.endsWith(path.sep))
                    fullPath += path.sep;

                fs.readdir(fullPath, { encoding: this.encoding, withFileTypes: true }, (err, filesIn) => {
                    let isNode10 = driver.nodeVersion('10.0.0');

                    if (err)
                        return resolve(err);

                    if (!isNode10) {
                        let results = [];
                        let pushResult = (res) => {
                            results.push(res);
                            if (results.length === filesIn.length)
                                resolve(results);
                        };

                        if (!details)
                            return resolve(showFullPath ? filesIn.map(fn => this.mountPoint + relativePath + fn) : filesIn);

                        async.eachLimit(filesIn, 10, (fn) => {
                            return new Promise((res, rej) => {
                                try {
                                    fs.stat(path.join(this.root, relativePath, fn), (err, stat) => {
                                        if (err) {
                                            rej(err);
                                            pushResult(err.message || err);
                                        }

                                        stat.name = showFullPath ? (isAbs ? '' : this.mountPoint) + relativePath + fn : fn;
                                        res(stat);
                                        pushResult(stat);
                                    });
                                }
                                catch (x) {
                                    pushResult(x);
                                }
                            });
                        });
                    }
                    else {

                        let files = filesIn
                            .filter(st => !pattern || pattern.test(st.name))
                            .map(fn => showFullPath ? (isAbs ? '' : this.mountPoint) + relativePath + fn.name : fn.name),
                            result = [];

                        if (!details) {
                            return resolve(files);
                        }

                        filesIn.forEach(fd => {
                            let fn = fd.name;

                            if (!fn) {
                                console.log(`WARNING: readDirectoryAsync(${relativePath}): File entry has no name`);
                                return false;
                            }

                            //  Is the file hidden?
                            if ((flags & MUDFS.GetDirFlags.Hidden) === 0 && fn.startsWith('.'))
                                return false;

                            // Do we need to stat?
                            if ((flags & MUDFS.GetDirFlags.Defaults) > 0) {
                                if (fd.isDirectory() && (flags & MUDFS.GetDirFlags.Dirs) === 0)
                                    return false;

                                if (fd.isFile() && (flags & MUDFS.GetDirFlags.Files) === 0)
                                    return false;

                                result.push(fd);
                            }
                            else
                                result.push(fd);
                        });
                        resolve(result);
                    }
                });
            }
            catch (err) {
                resolve(err);
            }
        });
    }

    /**
     * Reads a directory listing from the disk.
     * @param {string} relativePath The local path to read.
     * @param {string} fileName THe filename part of the path expression.
     * @param {number} flags Flags the control the read operation
     * @returns {any[]} Returns information about the directory/contents
     */
    readDirectorySync(relativePath, fileName, flags) {
        try {
            let fullPath = this.translatePath(relativePath), isAbs = relativePath.startsWith(this.root);
            let showFullPath = (flags & MUDFS.GetDirFlags.FullPath) === MUDFS.GetDirFlags.FullPath,
                details = (flags & MUDFS.GetDirFlags.Details) === MUDFS.GetDirFlags.Details,
                pattern = fileName &&
                    new RegExp('^' + fileName
                        .replace(/\./g, '\\.')
                        .replace(/\?/g, '.')
                        .replace(/\*/g, '.+') + '$');

            if (flags & MUDFS.GetDirFlags.ImplicitDirs && !fullPath.endsWith(path.sep))
                fullPath += path.sep;

            let files = fs.readdirSync(fullPath, { encoding: this.encoding })
                .filter(fn => !pattern || pattern.test(fn))
                .map(fn => showFullPath ? (isAbs ? '' : this.mountPoint) + relativePath + fn : fn),
                result = [];

            if (!details)
                return files;

            files.forEach(fn => {
                let fd = this.createStat({
                    exists: true,
                    name: fn,
                    parent: fullPath
                });

                //  Is the file hidden?
                if ((flags & MUDFS.GetDirFlags.Hidden) === 0 && fn.startsWith('.'))
                    return false;

                // Do we need to stat?
                if ((relativePath.flags & MUDFS.GetDirFlags.Defaults) > 0) {
                    let stat = fs.statSync(fullPath + '/' + fn);

                    if ((fd.isDirectory = stat.isDirectory()) && (relativePath.flags & MUDFS.GetDirFlags.Dirs) === 0)
                        return false;

                    if ((fd.isFile = stat.isFile()) && (relativePath.flags & MUDFS.GetDirFlags.Files) === 0)
                        return false;

                    fd.merge(stat);
                }
                result.push(fd);
            });
            return result;
        }
        catch (err) {
            throw err;
        }
    }

    /**
     * Read a file syncronously from the filesystem.
     * @param {FileSystemRequest} req The file request.
     * @returns {string} The contents of the file.
     */
    readFileSync(req) {
       let fullPath = this.translatePath(req),
            result = this.stripBOM(fs.readFileSync(fullPath, { encoding: this.encoding || 'utf8' }));
        return result;
    }

    readJsonFileAsync(expr) {
        let fullPath = this.translatePath(expr);
        return new Promise((resolve, reject) => {
            try {
                fs.readFile(fullPath, (err, content) => {
                    if (err) {
                        switch (err.code) {
                            case 'ENOENT': // File does not exist
                            case 'EISDIR': // File is a directory
                                return resolve(err);

                            default:
                                return reject(err);
                        }
                    }
                    else {
                        let ob = JSON.parse(content);
                        resolve(ob);
                    }
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Read JSON/structured data from a file asyncronously.
     * @param {string} req The path to read from.
     * @returns {any} Structured data.
     */
    readJsonFileSync(req) {
        let fullPath = this.translatePath(req);
        try {
            return JSON.parse(this.readFileSync(fullPath));
        }
        catch (err) {
            /* eat the error */
        }
        return false;
    }

    statAsync(localPath) {
        let fullPath = this.translatePath(localPath);

        return new Promise((resolve) => {
            try {
                fs.stat(fullPath, (err, stats) => {
                    if (err) {
                        resolve(driver.fileManager.createDummyStats(err, fullPath));
                    }
                    else {
                        let stat = Object.assign(stats, {
                            exists: true,
                            name: localPath.slice(localPath.lastIndexOf('/') + 1),
                            path: path.posix.join(this.mountPoint, localPath)
                        });
                        resolve(stat);
                    }
                });
            }
            catch (err) {
                resolve(driver.fileManager.createDummyStats(err, fullPath));
            }
        });
    }

    /**
     * Stat a file syncronously.
     * @param {string} localPath The path info to stat.
     * @param {number} flags Optional flags for additional control.
     * @returns {FileSystemStat} A filestat object (if possible)
     */
    statSync(localPath, flags = 0) {
        let fullPath = this.translatePath(localPath);
        return this.createStat(() => {
            let stat = fs.statSync(fullPath);

            if ((flags & MUDFS.StatFlags.Content) > 0) {
                stat.content = this.readFileSync(fullPath);
            }
            return stat;
        });
    }

    /**
     * Returns a string without a Byte Order Marker (BOM)
     * @param {string|Buffer} content The content to check for BOM
     * @returns {string} The string minus any BOM.
     */
    stripBOM(content) {
        if (this.autoStripBOM) {
            if (typeof content === 'string' && content.charCodeAt(0) === 0xFEFF) {
                content = content.slice(1);
            }
        }
        return content;
    }

    /**
     * Translates a virtual path into an absolute path
     * @param {FileSystemRequest|string} req The virtual MUD path.
     * @param {function(string):void=} callback  An optional callback... this is depricated.
     * @returns {string} The absolute filesystem path.
     */
    translatePath(req, callback) {
        if (typeof req === 'string') {
            if (req.startsWith(this.root) && req.indexOf('..') === -1)
                return callback ? callback(req) : req;
            let result = path.join(this.root, req);
            if (!result.startsWith(this.root))
                throw new Error('Access violation');
            return callback ? callback(result) : result;
        }
        else return this.translatePath(req.relativePath, callback);
    }

    /**
     * Creates or overwites an existing file.
     * @param {FileSystemRequest} req The virtual MUD path.
     * @param {function(string):void=} callback  The callback thast receives success or failure notification.
     * @returns {void} Returns nothing for async.
     */
    writeFileAsync(req, content, callback) {
        throw new Error('Not implemented');
    }

    /**
     * Creates or overwites an existing file.
     * @param {string} expr The virtual MUD path.
     * @param {string|Buffer} content The content to write to file
     * @param {number} flag A flag indicating mode, etc
     * @returns {boolean} Returns true on success.
     */
    writeFileSync(expr, content, flag) {
        let fullPath = this.translatePath(expr);
        try {
            fs.writeFileSync(fullPath, content, {
                encoding: this.encoding || 'utf8',
                flag: flag ? 'a' : 'w'
            });
            return true;
        }
        catch (err) {
            /* eat the error */
        }
        return false;
    }
}

module.exports = DefaultFileSystem;
