/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    BaseFileSystem = require('./BaseFileSystem'),
    { DirectoryObject, FileObject, FileSystemObject, ObjectNotFound, DirectoryWrapper } = require('./FileSystemObject'),
    async = require('async'),
    path = require('path'),
    yaml = require('js-yaml'),
    fs = require('fs'),
    Dirent = fs.Dirent;

/** Represents a directory on a disk */
class DiskDirectoryObject extends DirectoryObject {
    constructor(stat, request) {
        super(stat, request);
    }

    /**
     * To increase performance, the directory caches file information.
     * @type {FileSystemObject[]} */
    #cache = false;

    /**
     * Read from the directory
     * @param {string} [pattern] Optional file pattern to match on
     * @returns {Promise<FileSystemObject[]>} Returns contents of the directory
     */
    async readAsync(pattern = undefined, flags = 0) {
        if (!await this.valid('validReadDirectoryAsync'))
            return false;

        return new Promise(async (resolve, reject) => {
            let fileSystem = driver.fileManager.getFileSystemById(this.fileSystemId),
                fullPath = fileSystem.getRealPath(this.relativePath),
                returnResults = (err = undefined) => {
                    if (err) return reject(err);
                    let regex = pattern && DiskFileSystem.createPattern(pattern);
                    let results = this.#cache
                        .filter(f => !regex || regex.test(f.name));

                    if (driver.efuns.checkFlags(flags, MUDFS.GetDirFlags.FullPath))
                        return resolve(results = results.map(f => f.path));
                    else
                        return resolve(results);
                };

            if (this.#cache)
                return returnResults();
            else 
                fs.readdir(fullPath, { withFileTypes: true }, async (err, files) => {
                    if (err) return reject(err);
                    let promiseList = files.map(stat => driver.fileManager
                        .getObjectAsync(path.posix.join(this.path, stat.name)));

                    let results = await Promise.allWithLimit(promiseList);
                    this.#cache = results;
                    return returnResults();
                });
        });
    }

    /**
     * Fetch a single file from the directory
     * @param {string} fileName The filesystem request
     * @returns {Promise<DiskFileObject>} Returns the file object if found.
     */
    async getFileAsync(fileName) {
        return new Promise(async (resolve, reject) => {
            try {
                let pathRequested = path.posix.join(this.path, fileName);
                let files = await this.readAsync(fileName);
                if (files.length === 0)
                    reject(`File not found: ${pathRequested}`);
                else if (files.length > 1)
                    reject(`Ambiguous file request: ${pathRequested}; Matched: ${files.map(f => f.name).join(', ')}`);
                else
                    resolve(files[0]);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    async refresh() {
        this.#cache = false;
    }
}

/** Represents a single file on a disk */
class DiskFileObject extends FileObject {
    constructor(stat, request) {
        super(stat, request);
    }

    /**
     * Copy the object to another location
     * @param {string} target The location to copy to
     * @param {number} [flags] Flags to control the copy
     */
    async copyAsync(target, flags = 0) {
        return new Promise(async (resolve, reject) => {
            let fileManager = driver.fileManager.getFileSystemById(this.fileSystemId),
                fullPath = fileManager.getRealPath(this.relativePath),
                destination = await driver.fileManager.statAsync(target);

            fs.copyFile(fullPath, destination.path, err => err ? reject(err) : resolve(true));
        });
    }

    /**
     * Delete the file
     */
    async deleteAsync() {
        if (this.exists) {
            return new Promise((resolve, reject) => {
                //  TODO: Security checks
                let fileSystem = driver.fileManager.getFileSystemById(this.fileSystemId),
                    fullPath = fileSystem.getRealPath(this.relativePath);

                fs.unlink(fullPath, err => err ? reject(err) : resolve(true));
            });
        }
        return false;
    }

    async moveAsync(target, flags = 0) {

    }

    /**
     * Read the file
     * @param {string} [encoding] The specific encoding to use
     * @param {boolean} [stripBOM] Strip byte order mark?
     */
    async readAsync(encoding, stripBOM = false) {
        if (this.exists) {
            return new Promise((resolve, reject) => {
                try {
                    //  TODO: Security checks
                    let fileManager = driver.fileManager.getFileSystemById(this.fileSystemId),
                        fullPath = fileManager.getRealPath(this.relativePath);

                    encoding = encoding === 'buffer' ? undefined : encoding || fileManager.encoding;

                    fs.readFile(fullPath, encoding, (err, content) => {
                        try {
                            if (err)
                                reject(err);

                            if (fileManager.autoStripBOM || stripBOM === true) {
                                if (typeof content === 'string') {
                                    if (content.charCodeAt(0) === 0xFEFF)
                                        content = content.slice(1);
                                }
                                else if (content.buffer[0] === 0xFEFF)
                                    content = content.slice(1);
                            }
                            resolve(content);
                        }
                        catch (err) {
                            reject(err);
                        }
                    });
                }
                catch (err) {
                    reject(err);
                }
            });
        }
        return undefined;
    }

    /**
     * Read the object as JSON data
     * @param {string} encoding The specific encoding to use
     * @param {boolean} stripBOM Strip byte order mark?
     */
    async readJsonAsync(encoding, stripBOM = false) {
        if (this.exists) {
            let result = await this.readAsync(encoding, stripBOM);
            return JSON.parse(result);
        }
        return undefined;
    }
}

class DiskObjectNotFound extends ObjectNotFound{
    /**
     * Actually create the non-existent directory
     * @param {FileSystemRequest} request
     * @returns {Promise<boolean>} Returns true on success
     */
    async createDirectoryAsync(request) {
        return new Promise(resolve => {
            try {
                let fileSystem = driver.fileManager.getFileSystemById(this.fileSystemId),
                    fullPath = fileSystem.getRealPath(this.relativePath);
                fs.mkdir(fullPath, err => resolve(!err));
            }
            catch (err) {
                resolve(false);
            }
        });
    }
}

/** Represents a disk-based filesystem */
class DiskFileSystem extends BaseFileSystem {
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
        this.flags = BaseFileSystem.FS_ASYNC |
            BaseFileSystem.FS_SYNC |
            BaseFileSystem.FS_DIRECTORIES |
            BaseFileSystem.FS_OBJECTS | 
            BaseFileSystem.FS_WILDCARDS;

        if (options.readOnly === true)
            this.flags |= BaseFileSystem.FS_READONLY;

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
     * @param {string} expr The file expression to convert.
     * @returns {string} The absolute filesystem path.
     */ 
    getRealPath(expr) {
        let result = path.join(this.root, expr);
        if (!result.startsWith(this.root))
            throw new Error(`Illegal access attempt: ${expr}`);
        return result;
    }

    /**
     * Clone an object syncronously.
     * @param {FileSystemRequest} request The request to clone an object.
     * @param {any[]} args Constructor args to pass to the new object.
     * @returns {MUDObject|false} The newly cloned object.
     */
    async cloneObjectAsync(request, args) {
        let fullPath = this.translatePath(request.relativePath),
            { file, type, instance } = driver.efuns.parsePath(request.fullPath),
            module = driver.cache.get(file);

        if (instance > 0)
            throw new Error(`cloneObject() cannot request a specific instance ID`);

        let ecc = driver.getExecution();
        try {
            if (!module || !module.loaded) {
                module = await driver.compiler.compileObjectAsync({ file, args });
            }
            if (module) {
                if (module.isVirtual)
                    return module.defaultExport;
                return await module.createInstanceAsync(type, false, args);
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
     * @param {FileSystemRequest} request
     * @param {any} flags
     */
    async createDirectoryAsync(request, flags) {
        let fullPath = this.translatePath(request.relativePath);
        let parts = path.relative(this.root, fullPath).split(path.sep),
            ensure = request.hasFlag(MUDFS.MkdirFlags.EnsurePath);

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
            let dir = path.posix.join(this.mountPoint, path.posix.sep, ...parts.slice(0, i + 1)),
                stat = await driver.fileManager.getObjectAsync(dir);

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
     * Create the filesystem object from a NodeJS stats object.
     * @param {fs.Stats} stats The information from fs.stat()
     * @param {FileSystemRequest} request The original request from the MUD
     * @param {Error} [err] An optional error if the fs.stat() failed
     * @returns {FileSystemObject}
     */
    async createObject(stats, request, err = null) {
        /** @type {FileSystemObject} */
        let normal = Object.assign({}, stats);

        normal.isBlockDevice = stats.isBlockDevice();
        normal.isCharacterDevice = stats.isCharacterDevice();
        normal.isDirectory = stats.isDirectory();
        normal.isFIFO = stats.isFIFO();
        normal.isFile = stats.isFile();
        normal.isSocket = stats.isSocket();
        normal.isSymbolicLink = stats.isSymbolicLink();

        normal.exists = normal.isBlockDevice ||
            normal.isCharacterDevice ||
            normal.isDirectory ||
            normal.isFIFO ||
            normal.isFile ||
            normal.isSocket ||
            normal.isSymbolicLink;

        if (!normal.path)
            normal.path = request.fullPath;
        if (!normal.name)
            normal.name = request.fileName;
        if (!normal.directory)
            normal.directory = request.directory;

        if (normal.isDirectory) {
            let result = new DiskDirectoryObject(normal, request);
            await result.readAsync();
            return result;
        }
        if (normal.isFile)
            return new DiskFileObject(normal, request);
        else if (!normal.exists)
            return new DiskObjectNotFound(normal, request);
    }

    /**
     * Converts a pattern string into a Regex
     * @param {string} expr
     * @returns {RegExp} The pattern as a regex
     */
    static createPattern(expr) {
        //  Looks like a pattern already
        if (/[\[\{\}\]\$\^]/.test(expr))
            return new RegExp(expr);
        expr = expr.replace(/\./g, '\\.');
        expr = expr.replace(/\*/g, '.+');
        expr = expr.replace(/\?/g, '.');
        return new RegExp('^' + expr + '$');
    }

    /**
     * Create a strongly-typed filesystem stat object.
     * @param {FileSystemObject} data The base stat object returned by Node
     * @param {FileSystemRequest} request The request that resulted in the stat
     * @returns {DiskDirectoryObject|DiskFileObject} Only files and directories are supported at the moment
     */
    createStatObject(data, request) {
        try {
            data = Object.assign(data, {
                directory: request.directory,
                exists: true,
                name: data.name || request.fileName,
                path: path.posix.join(this.mountPoint, request.relativePath)
            });

            data.isDirectory = data.isDirectory();
            data.isFile = data.isFile();
            data.isBlockDevice = data.isBlockDevice();
            data.isCharacterDevice = data.isCharacterDevice();
            data.isFIFO = data.isFIFO();
            data.isSocket = data.isSocket();
            data.isSymbolicLink = data.isSymbolicLink();

            if (data.isDirectory)
                return new DiskDirectoryObject(data, request);
            else if (data.isFile)
                return new DiskFileObject(data, request);
        }
        catch (err) {
            Object.freeze(this.createStatObject({
                error: err,
                exists: false,
                isDirectory: false,
                isFile: false,
                parent: null,
                size: -3
            }, request));
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
     * @param {FileSystemRequest} request The directory expression to fetch
     * @returns {Promise<DiskDirectoryObject>} A directory object
     */
    async getDirectoryAsync(request) {
        return new Promise(resolve => {
            let fullPath = this.translatePath(request.relativePath);
            try {
                fs.stat(fullPath, (err, stats) => {
                    if (err)
                        resolve(FileSystemObject.createDummyStats(request, err));
                    else if (stats.isDirectory())
                        resolve(this.createStatObject(stats, request));
                });
            }
            catch (err) {
                resolve(FileSystemObject.createDummyStats(request, err));
            }
        });
    }

    /**
     * Get a filesystem object.
     * @param {FileSystemRequest} request The filesystem request
     * @returns {Promise<DiskFileObject>} Returns a file object if the file is found.
     */
    async getFileAsync(request) {
        return new Promise(async (resolve, reject) => {
            try {
                let directory = await driver.fileManager.getDirectoryAsync(request.directory),
                    result = await directory.getFileAsync(request.fileName);
                return resolve(result);
            }
            catch (err) { reject(err);  }
        });
    }

    /**
     * Get a filesystem object from the expression provided.
     * @param {FileSystemRequest} request The filesystem request
     */
    getObjectAsync(request) {
        return new Promise((resolve, reject) => {
            try {
                let fullPath = this.translatePath(request.relativePath);

                fs.stat(fullPath, async (err, stats) => {
                    if (err) {
                        let stat = FileSystemObject.createDummyStats(request, err),
                            obj = new DiskObjectNotFound(stat, request, err);
                        return resolve(obj);
                    }
                    let result = await this.createObject(stats, request);
                    resolve(result);
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets a system file without the usual checks
     * @param {FileSystemRequest} request The request
     * @returns {Promise<DiskFileObject>} The system file (if found)
     */
    async getSystemFileAsync(request) {
        return await this.statAsync(request);
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
     * @returns {FileSystemObject[]} A collection of filesystem objects
     */
    async glob(relativePath, expr, options = 0) {
        let fullPath = this.translatePath(relativePath);
        let regex = DiskFileSystem.createPattern(expr);

        /** @type {fs.Dirent[]} */
        let files = await this.readDirectory(fullPath);
        return files
            .filter(fi => regex.test(fi.name))
            .map(fi => driver.fileManager.createObject(fi));
    }

    /**
     * Check to see if the expression is a directory.
     * @param {FileSystemRequest} request The filesystem request.
     * @returns {Promise<boolean|Error>} Returns true or false or an error
     */
    async isDirectoryAsync(request) {
        let stat = await this.statAsync(request);
        return stat.isDirectory;
    }

    /**
     * Check to see if the expression is a regular file
     * @param {FileSystemRequest} request The filesystem request.
     * @returns {Promise<boolean|Error}
     */
    async isFileAsync(request) {
        let stat = await this.statAsync(request);
        return stat.isFile;
    }

    /**
     * Load an object
     * @param {FileSystemRequest} request
     * @param {any} args
     */
    async loadObjectAsync(request, args) {
        let parts = driver.efuns.parsePath(request.fullPath),
            module = driver.cache.get(parts.file),
            forceReload = !module || request.hasFlag(1);

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
     * Read the contents of a directory
     * @param {FileSystemRequest} request The relative or absolute path to read
     * @param {Glob} [flags] Optional flags
     * @returns {Promise<Dirent[]>} The files in the directory
     */
    async readDirectoryAsync(request, fileName, flags) {
        let stat = await this.getDirectoryAsync(request);

        if (!stat.isDirectory) {
            let parent = await stat.getParent();
            return await parent.readAsync(stat.name || request.fileName, request.flags);
        }
        else
            return await stat.readAsync(undefined, request.flags);

        return new Promise(resolve => {
            try {
                let fullPath = this.translatePath(request.relativePath),
                    isAbs = request.relativePath.startsWith(this.root);

                let showFullPath = request.hasFlag(MUDFS.GetDirFlags.FullPath),
                    details = request.hasFlag(MUDFS.GetDirFlags.Details),
                    pattern = request.name && new RegExp('^' + request.name
                            .replace(/\./g, '\\.')
                            .replace(/\?/g, '.')
                            .replace(/\*/g, '.+') + '$');

                if (request.hasFlag(MUDFS.GetDirFlags.ImplicitDirs) && !fullPath.endsWith(path.sep))
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
                            return resolve(showFullPath ? filesIn.map(fn => this.mountPoint + request.relativePath + fn) : filesIn);

                        async.eachLimit(filesIn, 10, (fn, cb) => {
                            return new Promise((res, rej) => {
                                try {
                                    fs.stat(path.join(this.root, request.relativePath, fn), (err, stat) => {
                                        try {
                                            if (err) {
                                                rej(err);
                                                pushResult(err.message || err);
                                            }

                                            stat.name = showFullPath ? (isAbs ? '' : this.mountPoint) + request.relativePath + fn : fn;
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
                            .map(fn => showFullPath ? (isAbs ? '' : this.mountPoint) + request.relativePath + fn.name : fn.name),
                            result = [];

                        if (!details) {
                            return resolve(files);
                        }

                        filesIn.forEach(fd => {
                            let fn = fd.name;

                            if (!fn) {
                                console.log(`WARNING: readDirectoryAsync(${request.relativePath}): File entry has no name`);
                                return false;
                            }

                            //  Is the file hidden?
                            if (request.hasFlag(MUDFS.GetDirFlags.Hidden) && fn.startsWith('.'))
                                return false;

                            // Do we need to stat?
                            if (request.hasFlag(MUDFS.GetDirFlags.Defaults)) {
                                if (fd.isDirectory() && !request.hasFlag(MUDFS.GetDirFlags.Dirs))
                                    return false;

                                if (fd.isFile() && !request.hasFlag(MUDFS.GetDirFlags.Files))
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
     * Read a file asynchronously.
     * TODO: MOVE TO FILEMANAGER
     * @param {FileSystemRequest} request The file being requested.
     * @returns {Promise<string>}
     */
    readFileAsync(request) {
        return new Promise(async (resolve, reject) => {
            try {
                let fileObject = await this.getFileAsync(request)
                    .catch(err => reject(err));
                return resolve(await fileObject.readAsync());
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Read a JSON file asynchronously
     * @param {FileSystemRequest} request
     */
    async readJsonAsync(request) {
        try {
            let content = await this.readFileAsync(request)
            return JSON.parse(content);
        }
        catch (e) {
            console.log(`readJsonAsync(): Error ${e.message}`);
        }
        return undefined;
    }

    /**
     * Read some YAML
     * @param {FileSystemRequest} request
     */
    async readYamlAsync(request) {
        let content = await this.readFileAsync(request);
        return yaml.safeLoad(content);
    }

    /**
     * 
     * @param {FileSystemRequest} request
     * @param {number} [flags] Flags associated with the request
     * @returns {Promise<FileSystemObject>}
     */
    async statAsync(request) {
        let fullPath = this.translatePath(request.relativePath);

        return new Promise(async (resolve) => {
            let result, stat = {
                exists: false,
                name: request.fileName,
                path: path.posix.join(this.mountPoint, request.relativePath)
            };

            try {
                fs.stat(fullPath, async (err, data) => {
                    if (err) {
                        result = new DiskObjectNotFound(
                            FileSystemObject.createDummyStats(request, err),
                            request,
                            err);
                    }
                    else {
                        stat = Object.assign(data, {
                            exists: true,
                            name: request.fileName,
                            path: path.posix.join(this.mountPoint, request.relativePath)
                        });
                        result = this.createStatObject(stat, request);
                    }
                    resolve(result);
                });
            }
            catch (err) {
                stat = Object.assign(stat, FileSystemObject.createDummyStats(request, err));
                resolve(stat);
            }
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
     * @param {FileSystemRequest|string} request The virtual MUD path.
     * @param {function(string):void=} callback  An optional callback... this is depricated.
     * @returns {string} The absolute filesystem path.
     */
    translatePath(request, callback) {
        if (typeof request === 'string') {
            if (request.startsWith(this.root) && request.indexOf('..') === -1)
                return callback ? callback(request) : request;
            let result = path.join(this.root, request);
            if (!result.startsWith(this.root))
                throw new Error('Access violation');
            return callback ? callback(result) : result;
        }
        else if (!request)
            throw new Error('Something went wrong');
        else
            return this.translatePath(request.relativePath, callback);
    }

    /**
     * Write to a file
     * @param {FileSystemRequest} request The virtual MUD path.
     * @param {string|Buffer} content The content to write to file
     * @param {string|number} [flag] A flag indicating mode, etc
     * @param {string} [encoding] The optional encoding to use
     * @returns {boolean} Returns true on success.
     */
    async writeFileAsync(request, content, flag, encoding) {
        let fullPath = this.translatePath(request.relativePath);

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
     * @param {FileSystemRequest} request The file to write to
     * @param {object|string} content The content to write
     * @param {string} [encoding] The file encoding to use
     * @param {number} [indent] The amount to indent by (for pretty JSON)
     */
    async writeJsonAsync(request, content, encoding = 'utf8', indent = 3) {
        if (typeof content !== 'string')
            content = JSON.stringify(content, undefined, indent || undefined);
        return await this.writeFileAsync(request, content, 'w', encoding);
    }
}

module.exports = DiskFileSystem;

