/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    { FileACL, FileManager, FileSystem, FileSystemStat, StatFlags } = require('../FileSystem'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    Dirent = fs.Dirent;

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
     * Clone an object syncronously.
     * @param {string} req The request to clone an object.
     * @param {any[]} args Constructor args to pass to the new object.
     * @returns {MUDObject|false} The newly cloned object.
     */
    async cloneObjectAsync(req, args) {
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
                module = await driver.compiler.compileObjectAsync({ file, args });
            }
            if (module) {
                return await module.createInstanceAsync(file, type, args);
            }
        }
        catch (err) {
            logger.log('cloneObjectAsync() error:', err.message);
        }
        finally {
            ecc.popCreationContext();
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

    /**
     * Creates a directory
     * @param {any} expr
     * @param {any} flags
     */
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

            if (stat.exists && !stat.isDirectory)
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
            else if (stat.isDirectory)
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
     * Converts a pattern string into a Regex
     * @param {string} expr
     * @returns {RegExp} The pattern as a regex
     */
    createPattern(expr) {
        expr = expr.replace(/\./g, '\\.');
        expr = expr.replace(/\*/g, '.+');
        expr = expr.replace(/\?/g, '.');
        return new RegExp(expr);
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

                if (!stat.exists && (stat.atime > 0 || stat.isDirectory || stat.isFile))
                    stat.exists = true;
                return Object.freeze(new FileSystemStat(stat, this.mountPoint));
            }
            else if (typeof statFunc === 'object') {
                if (!stat.exists && (stat.atime > 0 || stat.isDirectory || stat.isFile))
                    stat.exists = true;
                return Object.freeze(new FileSystemStat(stat, this.mountPoint));
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
     * Removes a directory from the filesystem.
     * @param {string} relativePath The path of the directory to remove.
     * @param {any} flags TBD
     */
    async deleteDirectoryAsync(relativePath, flags) {
        let fullPath = this.translatePath(relativePath);
        return new Promise((resolve, reject) => {
            fs.rmdir(fullPath, { recursive: flags & 1 > 0 }, err => {
                if (err) reject(err);
                else resolve(true);
            });
        });
    }

    /**
     * Get a directory object
     * @param {string} expr The directory expression to fetch
     * @param {any} flags Flags to control the operation
     */
    async getDirectoryAsync(expr, flags = 0) {

    }

    async getFileACL(relativePath) {
        let aclFile = `${relativePath}/.acl`;
        if (await this.isFileAsync(aclFile)) {
            let content = await this.readJsonAsync(aclFile);
            return new FileACL(content);
        }
        return undefined;
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
     * Glob a directory
     * @param {string} relativePath The directory to search
     * @param {string} expr An expression to glob for
     * @param {Glob} options Options to control the operation
     * @returns {FileSystemStat[]} A collection of filesystem objects
     */
    async glob(relativePath, expr, options = 0) {
        let fullPath = this.translatePath(relativePath);
        let regex = this.createPattern(expr);

        /** @type {fs.Dirent[]} */
        let files = await this.readDirectory(fullPath);
        return files
            .filter(fi => regex.test(fi.name))
            .map(fi => driver.fileManager.createObject(fi));
    }

    /**
     * Check to see if the expression is a directory.
     * @param {string} relativePath The filesystem request.
     * @returns {Promise<boolean|Error>} Returns true or false or an error
     */
    isDirectoryAsync(relativePath) {
        let fullPath = this.translatePath(relativePath);
        return new Promise((resolve, reject) => {
            try {
                fs.stat(fullPath, (err, stat) => {
                    if (err)
                        resolve(err);
                    else
                        resolve(stat.isDirectory());
                });
            }
            catch (err) {
                resolve(err);
            }
        });
    }

    /**
     * @param {FileSystemRequest} req The filesystem request.
     * @param {function(boolean,Error):void} callback
     * @returns {void} Nothing for async.
     */
    async isFileAsync(relativePath) {
        let absPath = this.translatePath(relativePath);
        return new Promise(resolve => {
            try {
                fs.stat(absPath, (err, stats) => {
                    if (err) resolve(false);
                    else if (!stats) resolve(false);
                    else resolve(stats.isFile());
                });
            }
            catch (err) {
                resolve(false);
            }
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

    async loadObjectAsync(req, args, flags) {
        let fullPath = path.posix.join(this.mountPoint, '/', req),
            parts = driver.efuns.parsePath(fullPath),
            module = driver.cache.get(parts.file),
            forceReload = !module || (flags & 1 === 1);

        if (forceReload) {
            module = await driver.compiler.compileObjectAsync({
                args,
                file: parts.file,
                reload: forceReload
            });
            if (!module)
                throw new Error(`Failed to load module ${fullPath}`);
        }
        return module.getInstanceWrapper(parts);
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

    /**
     * Read the contents of a directory
     * @param {string} relativePath The relative or absolute path to read
     * @param {Glob} [flags] Optional flags
     * @returns {Promise<Dirent[]>} The files in the directory
     */
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

                        async.eachLimit(filesIn, 10, (fn, cb) => {
                            return new Promise((res, rej) => {
                                try {
                                    fs.stat(path.join(this.root, relativePath, fn), (err, stat) => {
                                        try {
                                            if (err) {
                                                rej(err);
                                                pushResult(err.message || err);
                                            }

                                            stat.name = showFullPath ? (isAbs ? '' : this.mountPoint) + relativePath + fn : fn;
                                            res(stat);
                                            pushResult(stat);
                                        }
                                        catch (ix) {
                                            pushResult(ix.message || ix);
                                        }
                                        finally {
                                            cb();
                                        }
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
     * Read a file asynchronously.
     * @param {string} req The file being requested.
     * @returns {Promise<string>}
     */
    readFileAsync(req) {
        let fullPath = this.translatePath(req);
        return new Promise((resolve, reject) => {
            fs.readFile(fullPath, { encoding: this.encoding || 'utf8' }, (err, data) => {
                if (err) reject(err);
                else resolve(this.stripBOM(data));
            });
        });
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

    /**
     * Read a JSON file asynchronously
     * @param {any} expr
     */
    async readJsonAsync(expr) {
        try {
            let content = await this.readFileAsync(expr)
            return JSON.parse(content);
        }
        catch (e) {
            console.log(`readJsonAsync(): Error ${e.message}`);
        }
        return undefined;
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

    /**
     *
     * @param {string} relativePath
     * @param {StatFlags} flags
     * @returns {FileSystemStat}
     */
    async stat(relativePath, flags = 0) {
        let fullPath = this.translatePath(relativePath);
        return new Promise(async (resolve) => {
            try {
                fs.stat(fullPath, async (err, stats) => {
                    let stat = FileSystem.createObject(err, stats);
                    if ((flags & StatFlags.Content) > 0) {
                        stat.content = await this.readFileAsync(fullPath);
                    }
                    resolve(stat);
                });
            }
            catch (ex) {
                resolve(FileSystem.createObject(err, false));
            }
        });
    }

    /**
     * 
     * @param {string|FileSystemRequest} req
     * @param {number} [flags] Flags associated with the request
     * @returns {FileSystemStat}
     */
    async statAsync(req, flags = 0) {
        let fullPath = this.translatePath(req.relativePath || req);

        return new Promise(async (resolve) => {
            try {
                fs.stat(fullPath, async (err, stats) => {
                    if (err) {
                        resolve(driver.fileManager.createDummyStats(err, fullPath));
                    }
                    else {
                        let stat = Object.assign(stats, {
                            exists: true,
                            name: req.name || req.slice(req.lastIndexOf('/') + 1),
                            path: path.posix.join(this.mountPoint, req)
                        });
                        if ((flags & MUDFS.StatFlags.Content) > 0) {
                            stat.content = await this.readFileAsync(fullPath);
                        }
                        resolve(FileManager.createFileObjectSync(stat));
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
     * @param {string|FileSystemRequest} req The path info to stat.
     * @param {number} flags Optional flags for additional control.
     * @returns {FileSystemStat} A filestat object (if possible)
     */
    statSync(req, flags = 0) {
        let fullPath = this.translatePath(req.relativePath || req);
        let stat = undefined;
        try {
            stat = fs.statSync(fullPath);

            stat.relativeName = req;
            stat.name = req.split('/').pop();

            if ((flags & MUDFS.StatFlags.Content) > 0) {
                try {
                    stat.content = this.readFileSync(fullPath);
                }
                catch (err) {
                    stat.content = err;
                }
            }
        }
        catch (err) {
            stat = FileManager.createDummyStats(err, req);
        }
        return FileManager.createFileObjectSync(stat);
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
     * Write to a file
     * @param {string} expr The virtual MUD path.
     * @param {string|Buffer} content The content to write to file
     * @param {string|number} [flag] A flag indicating mode, etc
     * @param {string} [encoding] The optional encoding to use
     * @returns {boolean} Returns true on success.
     */
    async writeFileAsync(expr, content, flag, encoding) {
        let fullPath = this.translatePath(expr);

        return new Promise(resolve => {
            fs.writeFile(fullPath, 
                content,
                {
                    flag: flag || 'w',
                    encoding: encoding || this.encoding
                },
                err => {
                    if (err)
                        resolve(err);
                    else
                        resolve(true);
                });
        });
    }

    /**
     * 
     * @param {string} expr The file to write to
     * @param {object|string} content The content to write
     * @param {string} [encoding] The file encoding to use
     * @param {number} [indent] The amount to indent by (for pretty JSON)
     */
    async writeJsonAsync(expr, content, encoding = 'utf8', indent = 3) {
        if (typeof content !== 'string')
            content = JSON.stringify(content, undefined, indent || undefined);
        return await this.writeFileAsync(expr, content, 'w', encoding);
    }
}

module.exports = DefaultFileSystem;
