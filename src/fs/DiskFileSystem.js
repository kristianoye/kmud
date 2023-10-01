const { relative } = require('path');
const { isReturnStatement } = require('typescript');

/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    BaseFileSystem = require('./BaseFileSystem'),
    { FileSystemObject, ObjectNotFound, SecurityFlags, WrapperBase, FileWrapperObject } = require('./FileSystemObject'),
    { FileSystemQueryFlags } = require('./FileSystemFlags'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    fsPromises = fs.promises,
    Dirent = fs.Dirent;

/** 
 * Represents a disk-based file object 
 */
class DiskFileObject extends FileSystemObject {
    /**
     * Construct disk-based file object
     * @param {FileSystemObject} stat
     * @param {string} physicalPath
     */
    constructor(stat, physicalPath, manager) {
        super(stat);

        this.#manager = manager;
        this.#physicalLocation = physicalPath;

        if (this.isDirectory) {
            this.#directories = [];
            this.#files = [];
            this.#hasLoaded = false;
        }
        else 
            this.#files = this.#directories = false;
    }

    //#region Private Properties

    /**
     * Contains subdirectories or false if this is not a directory.
     * @type {FileSystemObject[] | false}
     */
    #directories;

    /**
     * Contains files or false if this is not a directory.
     * @type {FileSystemObject[] | false}
     */
    #files;

    /** 
     * If this is a directory, this flag indicates whether it has loaded contents.
     * @type {boolean}
     */
    #hasLoaded;

    /**
     * Reference to the file manager
     * @type {DiskFileSystem}
     */
    #manager;

    /**
     * Contains the physical location of the file on the underlyind drive
     * @type {string} 
     */
    #physicalLocation;

    //#endregion

    appendFileAsync(content, options = { encoding: 'utf8' }) {
        return this.writeFileAsync(content, { flags: 'a' });
    }

    /**
     * Attempt to create this as a directory
     */
    async createDirectoryAsync(createAsNeeded = false) {
        return new Promise(async (resolve, reject) => {
            if (this.exists) {
                if (createAsNeeded)
                    return resolve(true);
                else if (!this.isDirectory)
                    reject(`createDirectoryAsync: Path ${this.path} is not a directory.`);
                else
                    return reject(`createDirectoryAsync: Path ${this.path} already exists.`);
            }

            try {
                if (createAsNeeded === true) {
                    let parts = this.fullPath.split('/').filter(s => s.length > 0);
                    if (parts.length > 1) {
                        for (let i = 1, max = parts.length; i < max; i++) {
                            let parentPath = path.posix.join('/', ...parts.slice(0, i));
                            let parent = await driver.fileManager.getFileAsync(parentPath, 0, false === this.isWrapper());

                            if (!parent.exists) {
                                await parent.createDirectoryAsync();
                            }
                        }
                    }
                }
                fs.mkdir(this.#physicalLocation, async err => {
                    if (err)
                        return reject(err);
                    else {
                        await this.refreshAsync();
                        return resolve(true);
                    }
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Delete the file
     */
    async deleteAsync(...args) {
        if (this.isDirectory)
            return this.deleteDirectoryAsync(...args);
        else
            return this.deleteFileAsync(...args);
    }

    /**
     * Delete a directory
     * @param {string | { pattern: string, confirm: function(string): boolean, flags: number }} expr
     * @param {number} flags
     */
    async deleteDirectoryAsync(expr = '', flags = 0) {
        let deleteOperation = { pattern: '', confirm: () => true, flags: 0 };

        if (typeof expr === 'object') {
            deleteOperation = Object.assign(deleteOperation, expr);
        }
        else if (typeof expr === 'string') {
            deleteOperation.pattern = expr;
        }

        if (flags > 0) {
            deleteOperation.flags |= flags;
        }

        return new Promise(async (resolve, reject) => {
            if (!this.directory)
                return reject(`deleteFileAsync: Invalid operation: ${this.path} is not a directory`);

            let contents = await this.readDirectoryAsync(expr, flags);

            for (let i = 0; i < contents.length; i++) {
                if (deleteOperation.confirm(contents[i].path)) {
                    await contents[i].deleteAsync();
                }
            }
        });
    }

    async deleteFileAsync() {
        return new Promise((resolve, reject) => {
            try {
                if (this.isDirectory)
                    return reject(`deleteFileAsync: Invalid operation: ${this.path} is a directory`);
                else
                    fs.unlink(this.#physicalLocation, err => err ? reject(err) : resolve(true));
            }
            catch (ex) {
                reject(ex);
            }
        });
    }

    async getFileAsync(fileName) {
        return this.getObjectAsync(fileName);
    }

    async getObjectAsync(fileName) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.#loadDirectoryInternal();
                let file = this.#files.find(file => file.name === fileName);
                if (file)
                    return resolve(file);
                else if ((file = this.#directories.find(file => file.name === fileName)))
                    return resolve(file);
                else
                    return reject(`Could not find ${fileName}`);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    async #loadDirectoryInternal() {
        if (!this.isDirectory || this.#hasLoaded)
            return true;

        await this.#manager.getDirectoryContentsAsync(this.#physicalLocation)
            .then(result => {
                this.#directories = result.directories;
                this.#files = result.files;
            })
            .catch(err => {
                this.#directories = [];
                this.#files = [];
            });

        return (this.#hasLoaded = true);
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
     * Read information from a directory
     * @param {string} pattern
     * @param {number} flags
     * @returns {Promise<FileSystemObject[]>}
     */
    async readDirectoryAsync(pattern = '', flags = 0) {
        let isSystemRequest = this.hasWrapper === false;

        if (pattern.indexOf('/') > -1) {
            return driver.fileManager.queryFileSystemAsync(pattern, isSystemRequest);
        }
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
                    .getFileAsync(path.posix.join(this.path, stat.name), undefined, this.isSystemRequest));

                let results = await Promise.allWithLimit(promiseList);
                return await returnResults(undefined, results);
            });
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

    async refreshAsync() {
        return new Promise((resolve, reject) => {
            try {
                fs.stat(this.#physicalLocation, (err, stat) => {
                    stat = this.#manager.createNormalizedStats(this.#physicalLocation, stat || {}, err);
                    super.refreshAsync(stat);
                    resolve(true);
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    async writeAsync(...args) {
        if (this.isDirectory)
            return this.writeDirectoryAsync(...args);
        else
            return this.writeFileAsync(...args);
    }

    async writeJsonAsync(data, options = { indent: true, encoding: 'utf8' }) {
        let exportText = '';
        if (options.indent) {
            if (typeof options.indent === 'number')
                exportText = JSON.stringify(data, undefined, options.indent);
            else if (options.indent === true)
                exportText = JSON.stringify(data, undefined, 3);
        }
        else
            exportText = JSON.stringify(data);

        await this.writeFileAsync(exportText, options);
    }

    /**
     * Write to one or more files in the directory.
     * @param {string | Object.<string,string|Buffer|(string) => string>} fileNameOrContent
     * @param {any} options
     */
    async writeDirectoryAsync(fileNameOrContent, content , options = { encoding: 'utf8', flag: 'w' }) {
        let writes = [];

        if (typeof fileNameOrContent === 'object') {
            for (let [filename, data] of Object.entries(fileNameOrContent)) {
                if (typeof filename === 'string') {
                    if (typeof data === 'function')
                        data = data(filename);

                    writes.push(this.writeDirectoryAsync(filename, data, options));
                }
            }
            await Promise.all(writes);
        }
        else if (typeof fileNameOrContent === 'string') {
            return fsPromises.writeFile(fileNameOrContent, content, options);
        }
    }

    /**
     * Write to a single file
     * @param {string | Buffer} content
     * @param {{ encoding?: string, flags?: string }} options
     */
    writeFileAsync(content, options = { encoding: 'utf8', flags: 'w' }) {
        return new Promise((resolve, reject) => {
            try {
                fs.writeFile(this.#physicalLocation, content, options, () => resolve(true));
            }
            catch (ex) {
                reject(ex);
            }
        });
    }
}

/** 
 * Represents a disk-based filesystem 
 */
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

        this.isReadOnly = false;
        if (options.readOnly === true) {
            this.flags |= BaseFileSystem.FS_READONLY;
            this.isReadOnly = true;
        }

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
     * Method to help directories load their children
     * @param {string} pathIn The path to populate
     * @returns {Promise<{ directories: DiskFileObject[], files: DiskFileObject[]}>}
     */
    getDirectoryContentsAsync(pathIn) {
        const pathInfo = this.getPathInfo(pathIn);

        return new Promise((resolve, reject) => {
            try {
                fs.readdir(pathInfo.physicalPath, async (err, fileNames) => {
                    /**  @type {DiskFileObject[]} */
                    let directories = [];
                    /**  @type {DiskFileObject[]} */
                    let files = [];

                    if (err)
                        return reject(err);
                    else {
                        let statFile = (fileName) => {
                            return new Promise((success) => {
                                fs.stat(fileName, (err, stat) => {
                                    if (err)
                                        return success(this.createNormalizedStats(fileName, {}, err));
                                    else
                                        return success(this.createNormalizedStats(fileName, stat));
                                });
                            });
                        }
                        let statFiles = (fileNames) => {
                            return new Promise(async (success, failure) => {
                                await async.mapLimit(fileNames, 5, async (fileName) => {
                                    const fullPath = path.join(pathInfo.physicalPath, fileName);
                                    const stat = await statFile(fullPath);

                                    //  Special case for subdirectories that are also mount points
                                    if (stat.isDirectory && this.fileManager.isMountPoint(stat.fullPath)) {
                                        let result = await this.fileManager.getFileAsync(stat.fullPath, 0, true);
                                        return result;
                                    }

                                    return new DiskFileObject(stat, fullPath, this);
                                }, (err, results) => {
                                    if (err)
                                        return failure(err);
                                    else
                                        return success(results);
                                });
                            });
                        };

                        /** @type {DiskFileObject[]} */
                        let fileObjects = await statFiles(fileNames);

                        fileObjects.forEach(o => {
                            if (o.isDirectory) 
                                directories.push(o);
                            else
                                files.push(o);
                        });
                    }
                    resolve({ directories, files });
                });
            }
            catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Translate a physical or virtual path into useful information.
     * @param {string} pathIn
     * @returns {{ directory: string, name: string, physicalPath: string, relativePath: string, virtualPath: string }}
     */
    getPathInfo(pathIn) {
        if (pathIn.indexOf('..') > -1)
            throw new Error(`getPathInfo(): Path expression may not contain '..'`);

        //  Physical path
        if (pathIn.startsWith(this.root)) {
            let vp = this.getVirtualPath(pathIn),
                n = vp.lastIndexOf('.');

            return {
                directory: path.posix.join('/', vp, '..'),
                extension: n > 0 ? vp.slice(n) : '',
                fileSystemId: this.systemId,
                mountPoint: this.mountPoint,
                name: vp.split('/').pop(),
                physicalPath: pathIn,
                relativePath: vp,
                virtualPath: path.posix.join('/', vp)
            };
        }
        //  Absolute virtual path
        else if (pathIn.startsWith(this.mountPoint))
            return this.getPathInfo(this.getRealPath(pathIn));
        //  Relative virtual path
        else if (!pathIn.startsWith('/'))
        {
            let virtualPath = path.posix.join(this.mountPoint, pathIn);
            return this.getPathInfo(this.getRealPath(virtualPath));
        }
        else
            return new Error(`getPathInfo() Could not translate path expression: ${pathIn}`);
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
                return path.posix.join(this.mountPoint, result);
            }
        }
        else if (expr.startsWith(this.root)) {
            let result = path.relative(this.root, expr);
            if (this.normalizer) {
                result = result.replace(this.normalizer, '/');
            }
            return path.posix.join(this.mountPoint, result);
        }
        return false;
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
                stat = await driver.fileManager.getFileAsync(dir);

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
     * Generate a normalized stat object.
     * 
     * @param {string} fullPath The full native path to the object.
     * @param {FileSystemObject} baseStat What information we CAN provide
     * @param {Error} err Any error associated with this request
     * @returns {FileSystemObject}} A basic stat object
     */
    createNormalizedStats(fullPath, baseStat = {}, err = false) {
        let getStatValue = (val, def = false) => {
            try {
                if (typeof val === 'function')
                    return val.call(baseStat);
                else if (typeof val !== 'undefined')
                    return val;
                else
                    return def;
            }
            catch (err) {
                return def;
            }
        };

        let dt = new Date(0);

        let pathInfo = this.getPathInfo(fullPath);
        let result = {
            atime: getStatValue(baseStat.atime, dt),
            atimeMs: getStatValue(baseStat.atime, dt.getTime()),
            birthtime: getStatValue(baseStat.birthtime, dt),
            birthtimeMs: getStatValue(baseStat.birthtimeMs, dt.getTime()),
            blksize: getStatValue(baseStat.blksize, 4096),
            blocks: getStatValue(baseStat.blocks, 0),
            ctime: getStatValue(baseStat.ctime, dt),
            ctimeMs: getStatValue(baseStat.ctimeMs, dt.getTime()),
            dev: getStatValue(baseStat.dev, -1),
            directory: pathInfo.directory,
            error: !err ? false : err || new Error('Unknown error'),
            exists: false,
            fullPath: pathInfo.virtualPath,
            gid: getStatValue(baseStat.gid, -1),
            ino: getStatValue(baseStat.ino, -1),
            isReadOnly: this.isReadOnly === true,
            nlink: getStatValue(baseStat.nlink, -1),
            uid: getStatValue(baseStat.uid, -1),
            mode: getStatValue(baseStat.mode, -1),
            mtime: dt,
            mtimeMs: dt.getTime(),
            name: baseStat.name || pathInfo.name,
            path: pathInfo.virtualPath,
            size: getStatValue(baseStat.size, -1),
            rdev: getStatValue(baseStat.rdev, -1),
            isBlockDevice: getStatValue(baseStat.isBlockDevice),
            isCharacterDevice: getStatValue(baseStat.isCharacterDevice),
            isDirectory: getStatValue(baseStat.isDirectory),
            isFIFO: getStatValue(baseStat.isFIFO),
            isFile: getStatValue(baseStat.isFile),
            isSocket: getStatValue(baseStat.isSocket),
            isSymbolicLink: getStatValue(baseStat.isSymbolicLink)
        };

        result.exists = result.isBlockDevice
            || result.isCharacterDevice
            || result.isDirectory
            || result.isFIFO
            || result.isFile
            || result.isSocket
            || result.isSymbolicLink;

        return result;
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

        return new DiskFileObject(normal, physicalPath, this);
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
     * @returns {FileSystemObject} Only files and directories are supported at the moment
     */
    createStatObject(data, physicalPath) {
        let result;

        try {
            result = new DiskFileObject(this.createNormalizedStats(physicalPath, data), physicalPath, this);
        }
        catch (err) {
            result = new DiskFileObject(this.createNormalizedStats(physicalPath, data, err), physicalPath, this);
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
     * @returns {Promise<FileSystemObject>} A directory object
     */
    async getDirectoryAsync(request) {
        return new Promise(async (resolve, reject) => {
            let fullPath = this.translatePath(request.relativePath),
                stats = await this.statAsync(request);

            if (stats.exists && stats.isDirectory)
                return resolve(new DiskFileObject(stats, fullPath, this));
            else
                return reject(`getDirectoryAsync(): ${stats.fullPath} is not a directory`);
        });
    }

    /**
     * Get a filesystem object.
     * @param {FileSystemRequest} request The filesystem request
     * @returns {Promise<FileSystemObject>} Returns a file object if the file is found.
     */
    async getFileAsync(request) {
        return new Promise(async (resolve, reject) => {
            try {
                let stats = await this.statAsync(request);
                return resolve(new DiskFileObject(stats, request.absolutePath, this));
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
        return this.getFileAsync(request);
    }

    /**
     * Gets a system file without the usual checks
     * @param {FileSystemRequest} request The request
     * @returns {Promise<FileSystemObject>} The system file (if found)
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
            let parent = await stat.getParentAsync();
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
        let fullPath = this.translatePath(request.relativePath);
        return new Promise(async (resolve, reject) => {
            try {
                fs.stat(fullPath, (err, data) => {
                    let stat = this.createNormalizedStats(fullPath, data, err);
                    resolve(stat);
                });
            }
            catch (ex) {
                reject(ex);
            }
        });
    }

    /**
     * Translates a virtual path into an absolute path
     * @param {FileSystemRequest|string} request The virtual MUD path.
     * @returns {string} The absolute filesystem path.
     */
    translatePath(request) {
        if (typeof request === 'string') {
            if (request.startsWith(this.root) && request.indexOf('..') === -1)
                return  request;
            let result = path.join(this.root, request);
            if (!result.startsWith(this.root))
                throw new Error('Access violation');
            return result;
        }
        else if (!request)
            throw new Error('Something went wrong');
        else
            return this.translatePath(request.relativePath);
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

