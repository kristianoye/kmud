const { isReturnStatement } = require('typescript');

/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    BaseFileSystem = require('./BaseFileSystem'),
    { FileSystemObject, ObjectNotFound, SecurityFlags, WrapperBase } = require('./FileSystemObject'),
    { FileSystemQueryFlags } = require('./FileSystemFlags'),
    { PermissionDeniedError } = require('../ErrorTypes'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    Dirent = fs.Dirent;

// - FileWrapper
//    - FileImplementation
//       - [Stat Object]

class DiskObjectBase extends FileSystemObject {
    /**
     * Construct a disk-based file object
     * @param {fs.Stats} stat The underlying info
     */
    constructor(stat, request) {
        super(stat)
    }

    get baseName() {
        let p = this.path;
        let n = p.lastIndexOf('.');

        return n > -1 ? p.substring(0, n) : p;
    }
}

/** 
 * Represents a disk-based file object */
class DiskFileObject extends DiskObjectBase {
    constructor(stat, physicalPath) {
        super(stat);
        this.#physicalLocation = physicalPath;
    }

    /**
     * Contains the physical location of the file on the underlyind drive
     * @type {string} */
    #physicalLocation;

    /**
     * Delete the file
     */
    async deleteAsync(...args) {
        if (this.isDirectory)
            return this.deleteDirectoryAsync(...args);
        else
            return this.deleteFileAsync(...args);
    }

    async deleteDirectoryAsync(expr, flags = 0) {
        return new Promise(async (resolve, reject) => {
            let contents = await this.readDirectoryAsync();
        });
    }

    async deleteFileAsync() {
        return new Promise((resolve, reject) => {
            try {
                fs.unlink(this.#physicalLocation, err => err ? reject(err) : resolve(true));
            }
            catch (ex) {
                reject(ex);
            }
        });
    }

    async getObjectAsync(fileName) {
        return new Promise(async (resolve, reject) => {
            if (!this.isDirectory)
                return reject('getObjectAsync() called on non-directory object');

            try {
                let pathRequested = path.posix.join(this.path, fileName);
                let files = await this.readDirectoryAsync(fileName);
                let isSystemRequest = this instanceof WrapperBase === false;
                let result = undefined;

                if (files.length === 0)
                    result = new DiskObjectNotFound(
                        FileSystemObject.createDummyStats(
                            {
                                directory: isSystemRequest ? this : driver.fileManager.wrapFileObject(this),
                                fileSystemId: this.fileSystemId,
                                path: pathRequested,
                                name: fileName
                            },
                            new Error(`File not found: ${pathRequested}`),
                            'getFileAsync'));
                else if (files.length > 1)
                    return reject(`Ambiguous file request: ${pathRequested}; Matched: ${files.map(f => f.name).join(', ')}`);
                else
                    result = files[0];

                if (isSystemRequest === true)
                    return resolve(result);
                else
                    return resolve(driver.fileManager.wrapFileObject(result));
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Read the file
     * @param {string} [encoding] The specific encoding to use
     * @param {boolean} [stripBOM] Strip byte order mark?
     */
    async readAsync(...args) {
        if (this.isDirectory)
            return this.readDirectoryAsync(...args);
        else
            return this.readFileAsync(...args);
    }

    /**
     * 
     * @param {string} pattern
     * @param {number} flags
     * @returns {Promise<FileSystemObject[]>}
     */
    async readDirectoryAsync(pattern = '', flags = 0) {
        let isSystemRequest = this instanceof WrapperBase === false;

        if (pattern.indexOf('/') > -1) {
            return driver.fileManager.queryFileSystemAsync(pattern, isSystemRequest);
        }
        return new Promise(async (resolve, reject) => {
            try {
                fs.readdir(this.#physicalLocation, { withFileTypes: true }, async (err, files) => {
                    if (err)
                        return reject(err);

                    let promiseList = files.map(stat => driver.fileManager
                        .getObjectAsync(path.posix.join(this.path, stat.name), undefined, this.systemObj));

                    let results = await Promise.allWithLimit(promiseList);

                    return await returnResults(undefined, results);
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    async readFileAsync(encoding = 'utf8', stripBOM = true) {
        return new Promise(async (resolve, reject) => {
            try {
                let fileManager = driver.fileManager.getFileSystemById(this.fileSystemId),
                    fullPath = this.#physicalLocation;

                encoding = encoding === 'buffer' ? undefined : encoding || fileManager.encoding;

                fs.readFile(fullPath, encoding, (err, content) => {
                    try {
                        if (err)
                            reject(err);

                        if (fileManager.autoStripBOM || stripBOM === true) {
                            content = efuns.stripBOM(content);
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

    /**
     * Write 
     * @param {any} content
     * @param {any} encoding
     */
    writeFileAsync(content, options = { encoding: 'utf8', flag: 'w' }) {
        return new Promise(async (resolve, reject) => {
            if (await this.can(SecurityFlags.P_WRITE)) {
                try {
                    fs.writeFile(this.#physicalLocation, content, options, err => {
                        if (err)
                            reject(err);
                        else
                            resolve(true);
                    });
                }
                catch (err) {
                    reject(err);
                }
            }
            else
                reject(new PermissionDeniedError(this.fullPath, 'writeFileAsync'));
        });
    }
}

/** Represents a directory on a disk */
class DiskDirectoryObject extends DiskObjectBase {
    constructor(stat, physicalLocation) {
        super(stat);
        this.#physicalLocation = physicalLocation;
    }

    /**
     * To increase performance, the directory caches file information.
     * @type {FileSystemObject[]} */
    #cache;

    /**
     * Contains the physical location of the file on the underlyind drive
     * @type {string} */
    #physicalLocation;

    /**
     * Read from the directory
     * @param {string} [pattern] Optional file pattern to match on
     * @returns {Promise<FileSystemObject[]>} Returns contents of the directory
     */
    async readAsync(pattern = undefined, flags = 0) {
        return new Promise(async (resolve, reject) => {
            let returnResults = async (err = undefined, objectList = []) => {
                let directoriesOnly = false,
                    searchSubdirectories = false,
                    extraPattern = false,
                    results = [];
                let regex = pattern && DiskFileSystem.createPattern(pattern);

                if (err)
                    return reject(err);

                if (pattern) {
                    if (typeof pattern !== 'string') {
                        throw new Error(`Unexpected pattern: ${pattern}`);
                    }
                    if (pattern.contains('/')) {
                        let parts = pattern.split('/');

                        pattern = parts.shift();
                        directoriesOnly = true;

                        if (parts.length)
                            extraPattern = parts.join('/');
                    }
                    if (pattern.contains('**')) {
                        let thisPattern = pattern.replace(/[\*]{2,}/, '*');

                        regex = DiskFileSystem.createPattern(thisPattern);

                        let workers = objectList.map(fo =>
                            new Promise(async (res, rej) => {
                                try {
                                    if (fo.isDirectory)
                                        return res(await fo.readAsync(pattern));
                                    else if (regex.test(fo.name))
                                        return res(fo);
                                    else
                                        return res(false);
                                }
                                catch (err) {
                                    rej(err);
                                }
                            }));

                        results = await Promise.allWithLimit(workers);
                        results = results.where(f => f !== false).selectMany().sort();
                        resolve(results);
                    }
                }
                results = objectList
                    .filter(f => {
                        if (directoriesOnly) {
                            if (!f.isDirectory)
                                return false;
                            else if (regex)
                                return regex.test(f.name);
                            else
                                return true;
                        }
                        else if (f.name === '.acl') //  TODO: Add proper system file filter
                            return false;
                        if (!regex || regex.test(f.name))
                            return true;
                        return false;
                    });

                if (driver.efuns.checkFlags(flags, MUDFS.GetDirFlags.FullPath))
                    return resolve(results = results.map(f => f.path));
                else
                    return resolve(results);
            };

            fs.readdir(this.#physicalLocation, { withFileTypes: true }, async (err, files) => {
                if (err) return reject(err);
                let promiseList = files.map(stat => driver.fileManager
                    .getObjectAsync(path.posix.join(this.path, stat.name), undefined, this.systemObj));

                let results = await Promise.allWithLimit(promiseList);
                return await returnResults(undefined , results);
            });
        });
    }

    /**
     * Fetch a single file from the directory
     * @param {string} fileName The filesystem request
     * @returns {Promise<DiskFileObject>} Returns the file object if found.
     */
    async getFileAsync(fileName) {
        return this.getObjectAsync(fileName);
    }

    async getObjectAsync(fileName) {
        return new Promise(async (resolve, reject) => {
            try {
                let pathRequested = path.posix.join(this.path, fileName);
                let files = await this.readAsync(fileName);
                let isSystemRequest = this instanceof WrapperBase === false;
                let result = undefined;

                if (files.length === 0)
                    result = new DiskObjectNotFound(
                        FileSystemObject.createDummyStats(
                            {
                                directory: isSystemRequest ? this : driver.fileManager.wrapFileObject(this),
                                fileSystemId: this.fileSystemId,
                                path: pathRequested,
                                name: fileName
                            },
                            new Error(`File not found: ${pathRequested}`),
                            'getFileAsync'));
                else if (files.length > 1)
                    return reject(`Ambiguous file request: ${pathRequested}; Matched: ${files.map(f => f.name).join(', ')}`);
                else
                    result = files[0];

                if (isSystemRequest === true)
                    return resolve(result);
                else
                    return resolve(driver.fileManager.wrapFileObject(result));
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

/** Represents a non-existent directory object */
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
     * Create the filesystem object from a NodeJS Stats object.
     * @param {fs.Stats} stats The information from fs.stat()
     * @param {Error} [err] An optional error if the fs.stat() failed
     * @returns {FileSystemObject}
     */
    createObjectAsync(stats, err = null, physicalPath = undefined) {
        /** @type {FileSystemObject} */
        let normal = Object.assign({}, stats);

        normal.isBlockDevice = stats.isBlockDevice();
        normal.isCharacterDevice = stats.isCharacterDevice();
        normal.isDirectory = stats.isDirectory();
        normal.isFIFO = stats.isFIFO();
        normal.isFile = stats.isFile();
        normal.isSocket = stats.isSocket();
        normal.isSymbolicLink = stats.isSymbolicLink();

        normal.fileSystemId = this.systemId;
        normal.mountPoint = this.mountPoint;

        normal.exists = normal.isBlockDevice ||
            normal.isCharacterDevice ||
            normal.isDirectory ||
            normal.isFIFO ||
            normal.isFile ||
            normal.isSocket ||
            normal.isSymbolicLink;

        if (!normal.path || !normal.name || !normal.directory) {
            throw new Error('Oops.  Invalid stat object');
        }

        if (normal.isDirectory)
            return new DiskDirectoryObject(normal, physicalPath);
        if (normal.isFile)
            return new DiskFileObject(normal, physicalPath);
        else if (!normal.exists)
            return new DiskObjectNotFound(normal, physicalPath);
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
     * @returns {DiskDirectoryObject|DiskFileObject} Only files and directories are supported at the moment
     */
    createStatObject(data, physicalPath) {
        let result;

        try {
            data.isDirectory = data.isDirectory();
            data.isFile = data.isFile();
            data.isBlockDevice = data.isBlockDevice();
            data.isCharacterDevice = data.isCharacterDevice();
            data.isFIFO = data.isFIFO();
            data.isSocket = data.isSocket();
            data.isSymbolicLink = data.isSymbolicLink();

            if (data.isDirectory)
                return new DiskDirectoryObject(data, physicalPath);
            else if (data.isFile)
                return new DiskFileObject(data, physicalPath);
        }
        catch (err) {
            result = this.manager.createDummyStats(data, err);
        }
        return result;
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
                        resolve(this.createStatObject(stats, request, fullPath));
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
     * @returns {Promise<FileSystemObject>}
     */
    getObjectAsync(request) {
        return this.statAsync(request);
    }

    /**
     * Gets a system file without the usual checks
     * @param {FileSystemRequest} request The request
     * @returns {Promise<DiskFileObject>} The system file (if found)
     */
    async readSystemFileAsync(request) {
        return new Promise(async resolve => {
            let fullDiskPath = this.translatePath(request.relativePath);
            fs.readFile(fullDiskPath, { encoding: 'utf8' }, (err, data) => {
                if (err)
                    resolve(false);
                else
                    resolve(efuns.stripBOM(data));
            });
        });
    }

    /**
     * Translate an absolute path back into a virtual path.
     * @param {string} expr The absolute path to translate.
     * @returns {string|false} The virtual path if the expression exists in this filesystem or false if not.
     */
    getVirtualPath(expr) {
        if (path.sep !== path.posix.sep) {
            if (expr.toLowerCase().startsWith(this.root.toLowerCase())) {
                let result = path.relative(this.root, expr);
                if (this.normalizer) {
                    result = result.replace(this.normalizer, '/');
                }
                return result;
            }
        }
        else {
            if (expr.startsWith(this.root)) 
                return path.relative(this.root, expr);
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
     * Query the filesystem
     * @param {FileSystemQuery} query
     */
    queryFileSystemAsync(query) {
        return new Promise((resolve, reject) => {
            try {
                let abspath = this.translatePath(query.relativePath);
                fs.readdir(abspath, { withFileTypes: true }, async (err, content) => {
                    try {
                        if (err)
                            return reject(err);

                        for (let i = 0, max = content.length; i < max; i++) {
                            content[i] = await this.statAsync({
                                relativePath: path.posix.join(query.relativePath, content[i].name),
                                fileName: content[i].name
                            });
                        }

                        if (query.expression) {
                            if (query.expression instanceof RegExp) {
                                content = content.filter(f => query.expression.test(f.name));
                            }
                            else if (typeof query.expression === 'string') {
                                content = content.filter(f => query.expression === f.name);
                            }
                        }
                        let dirs = content.filter(f => f.isDirectory),
                            files = content.filter(f => f.isFile),
                            finalResults = [];

                        if (query.hasFlag(FileSystemQueryFlags.Recursive) && !query.atMaxDepth) {
                            for (let i = 0, max = dirs.length; i < max; i++) {
                                let dir = dirs[i];
                                let subDir = path.posix.join(this.mountPoint, query.relativePath, dir.name);

                                let subQuery = query.clone({
                                    path: subDir,
                                    queryDepth: query.queryDepth + 1
                                });
                                let subResult = await query.fileManager.queryFileSystemAsync(subQuery, subQuery.isSystemRequest);
                                finalResults = finalResults.concat(subResult);
                            }
                        }
                        if (dirs.length > 0 && !query.hasFlag(FileSystemQueryFlags.IgnoreDirectories)) {
                            if (true === query.expression instanceof RegExp)
                                dirs = dirs.filter(dir => query.expression.test(dir.name));
                            else if (typeof query.expression === 'string')
                                dirs = dirs.filter(dir => query.expression === dir.name);

                            finalResults = finalResults.concat(dirs);
                        }

                        if (files.length > 0 && !query.hasFlag(FileSystemQueryFlags.IgnoreFiles)) {
                            if (true === query.expression instanceof RegExp)
                                files = files.filter(file => query.expression.test(file.name));
                            else if (typeof query.expression === 'string')
                                files = files.filter(file => query.expression === file.name);

                            for (let i = 0, max = files.length; i < max; i++) {
                                files[i] = await this.statAsync({
                                    relativePath: path.posix.join(query.relativePath, files[i].name),
                                    fileName: files[i].name
                                });
                            }

                            finalResults = finalResults.concat(files);
                        }

                        resolve(finalResults);
                    }
                    catch (ex) {
                        reject(ex);
                    }
                });
            }
            catch (err) {
                reject(err);
            }
        });
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
     * 
     * @param {FileSystemRequest} request
     * @returns {Promise<FileSystemObject>}
     */
    async statAsync(request) {
        let fullPath = this.translatePath(request.relativePath),
            fullMudPath = path.posix.join(this.mountPoint, request.relativePath);

        return new Promise(async (resolve) => {
            let result, stat = {
                exists: false,
                name: request.fileName,
                directory: path.posix.resolve(fullMudPath, '..'),
                fileSystemId: this.systemId,
                mountPoint: this.mountPoint,
                path: fullMudPath
            };

            try {
                fs.stat(fullPath, async (err, data) => {
                    if (err) {
                        result = new DiskObjectNotFound(FileSystemObject.createDummyStats(stat, err), err);
                    }
                    else {
                        stat = Object.assign(data, stat, {
                            exists: true
                        });
                        result = this.createStatObject(stat, fullPath);
                    }
                    resolve(result);
                });
            }
            catch (err) {
                stat = Object.assign(stat, FileSystemObject.createDummyStats(stat, err));
                resolve(stat);
            }
        });
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

