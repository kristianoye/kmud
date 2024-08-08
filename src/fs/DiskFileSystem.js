/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    BaseFileSystem = require('./BaseFileSystem'),
    StreamPromises = require('stream/promises'),
    { FileSystemObject } = require('./FileSystemObject'),
    { FileSystemQueryFlags, CopyFlags } = require('./FileSystemFlags'),
    { ExecutionContext, CallOrigin } = require('../ExecutionContext'),
    { readdir, statfs } = require('fs/promises'),
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

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {string | Buffer} content
     * @param {{ encoding: string, flag: string }} options
     * @returns
     */
    async appendFileAsync(ecc, content, options = { encoding: 'utf8' }) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'appendFileAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            return await this.writeFileAsync(frame.branch(), content, { ...options, flag: 'a' });
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Copy a file to another location
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemObject} dest
     */
    async copyAsync(ecc, dest, flags = 0) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'copyAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (typeof dest === 'string')
                dest = await driver.fs.getObjectAsync(frame.branch(), dest);

            if ((flags & CopyFlags.NoFileClone) === 0 || !await this.tryDirectCopyAsync(frame.branch(), dest)) {
                const thisFile = await this.createReadStream(frame.branch());
                let parent = await dest.getParentAsync(frame.branch());

                parent = await parent.createDirectoryAsync(frame.branch(), true);

                let targetFile = await dest.createWriteStream(frame.branch());

                await StreamPromises.pipeline(thisFile, targetFile);
            }
            return true;
        }
        finally {
            frame.pop();
        }
        return false;
    }

    /**
     * Try and copy a file using the OS
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemObject} dest
     * @returns
     */
    async tryDirectCopyAsync(ecc, dest) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'tryDirectCopyAsync', isAsync: true, callType: CallOrigin.Driver });
        return new Promise(async resolve => {
            if (dest.storageType !== this.storageType)
                return false;
            else {
                /** @type {{ fileSystem: DiskFileSystem, relativePath: string }}*/
                let { fileSystem, relativePath } = driver.fileManager.getFilesystem(dest.fullPath),
                    physicalDest = fileSystem.getRealPath(frame.branch(), relativePath);

                fs.copyFile(this.#physicalLocation, physicalDest, fs.constants.COPYFILE_FICLONE, err => {
                    if (err)
                        resolve(false);
                    else
                        resolve(true);
                });
            }
        }).finally(() => frame.pop());
    }

    /**
     * Attempt to create this as a directory
     * @param {ExecutionContext} ecc The current callstack
     * @param {{ createAsNeeded: boolean, errorIfExists: boolean }}
     * @returns
     */
    async createDirectoryAsync(ecc, { createAsNeeded, errorIfExists } = { createAsNeeded: false, errorIfExists: true }) {
        const frame = ecc.pushFrameObject({ file: __filename, method: 'createDirectoryAsync', isAsync: true, callType: CallOrigin.Driver }),
            pathParts = this.fullPath.split(path.posix.sep).slice(1),
            directoriesToCreate = !createAsNeeded ? [this.fullPath] : pathParts.flatMap((part, i) => {
                return path.join(pathParts.slice(0, i).join(path.posix.sep), part);
            });

        for (const [dirName, i] of Object.entries(directoriesToCreate)) {
            if ((i + 1) === directoriesToCreate.length) {

            }
        }
        return new Promise(async (resolve, reject) => {
            if (this.exists) {
                if (createAsNeeded)
                    return resolve(this);
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
                            let parent = await driver.fileManager.getFileAsync(frame.branch(), parentPath, 0, false === this.isWrapper());

                            if (!parent.exists) {
                                await parent.createDirectoryAsync(frame.branch(), createAsNeeded);
                            }
                        }
                    }
                }
                fs.mkdir(this.#physicalLocation, async err => {
                    if (err)
                        return reject(err);
                    else {
                        await this.refreshAsync(frame.branch());
                        return resolve(true);
                    }
                });
            }
            catch (err) {
                reject(err);
            }
        }).finally(() => frame.pop());
    }

    /**
     * Create a readable stream
     * @param {ExecutionContext} ecc The current callstack
     * @param {{ encoding: string, flags: string }} options
     * @returns
     */
    createReadStream(ecc, options = { encoding: 'utf8', flags: 'r' }) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'createReadStream', isAsync: false, callType: CallOrigin.Driver });
        try {
            if (this.isDirectory)
                throw new Error(`createReadStream(): ${this.fullPath} is a directory`);
            else {
                options = Object.assign({
                    encoding: 'utf8',
                    flags: 'r'
                }, options);
                return fs.createReadStream(this.#physicalLocation, options);
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Create a write stream
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} options
     * @returns {fs.WriteStream}
     */
    createWriteStream(ecc, options = { encoding: 'utf8', flags: 'w' }) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'createWriteStream', isAsync: false, callType: CallOrigin.Driver });
        try {
            if (this.isDirectory)
                throw new Error(`createWriteStream(): ${this.fullPath} is a directory`);
            else {
                options = Object.assign({
                    encoding: 'utf8',
                    flags: 'w'
                }, options);
                return fs.createWriteStream(this.#physicalLocation, options);
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Delete the file
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} args
     */
    async deleteAsync(ecc, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'deleteAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (this.isDirectory)
                return this.deleteDirectoryAsync(frame.branch(), ...args);
            else
                return this.deleteFileAsync(frame.branch(), ...args);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Delete a directory
     * @param {ExecutionContext} ecc The current callstack
     * @param {string | { pattern: string, confirm: function(string): boolean, flags: number }} expr
     * @param {number} flags
     */
    async deleteDirectoryAsync(ecc, expr = '', flags = 0) {
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

        let frame = ecc.pushFrameObject({ file: __filename, method: 'deleteAsync', isAsync: true, callType: CallOrigin.Driver });
        return new Promise(async (resolve, reject) => {
            if (!this.directory)
                return reject(`deleteFileAsync: Invalid operation: ${this.path} is not a directory`);

            let contents = await this.readDirectoryAsync(expr, flags);

            for (let i = 0; i < contents.length; i++) {
                if (deleteOperation.confirm(contents[i].path)) {
                    await contents[i].deleteAsync();
                }
            }
        }).finally(() => frame.pop());
    }

    /**
     * Delete a single file
     * @param {ExecutionContext} ecc The current callstack
     * @returns
     */
    async deleteFileAsync(ecc) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'deleteFileAsync', isAsync: true, callType: CallOrigin.Driver });
        return new Promise((resolve, reject) => {
            try {
                if (this.isDirectory)
                    return reject(`deleteFileAsync: Invalid operation: ${this.path} is a directory`);
                else
                    fs.unlink(this.#physicalLocation, err => {
                        if (err)
                            reject(err);
                        else resolve(true);
                    });
            }
            catch (ex) {
                reject(ex);
            }
            finally {
                frame.pop();
            }
        });
    }

    /**
     * Get a file
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} fileName
     * @returns
     */
    async getFileAsync(ecc, fileName) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getFileAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            return await this.getObjectAsync(fileName);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Get a child object
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} fileName
     * @returns
     */
    async getObjectAsync(ecc, fileName) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getFileAsync', isAsync: true, callType: CallOrigin.Driver });
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
            finally {
                frame.pop();
            }
        });
    }

    async isEmpty() {
        if (this.isDirectory) {
            await this.#loadDirectoryInternal();
            return this.#files.length === 0;
        }
        else if (this.isFile) {
            return this.size === 0;
        }
        else if (!this.exists) {
            return true;
        }
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
     * @param {ExecutionContext} ecc
     * @param {string} [encoding] The specific encoding to use
     * @param {boolean} [stripBOM] Strip byte order mark?
     */
    async readAsync(ecc, ...args) {
        let frame = ecc.pushFrameObject({ object: this, file: __filename, method: 'readAsync', isAsync: true });
        try {
            if (this.isDirectory)
                return await this.readDirectoryAsync(frame.branch(), ...args);
            else
                return await this.readFileAsync(frame.branch(), ...args);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Read information from a directory
     * @param {ExecutionContext} ecc
     * @param {string} pattern
     * @param {number} flags
     * @returns {Promise<FileSystemObject[]>}
     */
    async readDirectoryAsync(ecc, pattern = '', flags = 0) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'readDirectoryAsync', isAsync: true, callType: CallOrigin.Driver });

        let isSystemRequest = this.hasWrapper === false;

        if (pattern.indexOf('/') > -1) {
            try {
                return driver.fileManager.queryFileSystemAsync(frame.branch(), pattern, isSystemRequest);
            }
            finally {
                frame.pop();
            }
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

                if ((flags & MUDFS.GetDirFlags.FullPath) > 0)
                    return resolve(results = results.map(f => f.path));
                else
                    return resolve(results);
            };
            fs.readdir(this.#physicalLocation, { withFileTypes: true }, async (err, files) => {
                try {
                    if (err) return reject(err);
                    let promiseList = files.map(stat => driver.fileManager
                        .getObjectAsync(frame.branch(), path.posix.join(this.path, stat.name), undefined, this.isSystemRequest));

                    let results = await Promise.allWithLimit(promiseList);
                    return await returnResults(undefined, results);
                }
                finally {
                    frame.pop();
                }
            });
        })
    }

    /**
     * Actual implementation of readFile
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} encoding
     * @param {any} stripBOM
     * @returns
     */
    async readFileAsync(ecc, encoding = 'utf8', stripBOM = true) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'readFileAsync', isAsync: true, callType: CallOrigin.Driver });

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
                            content = efuns.stripBOM(frame.branch(), content);
                        }
                        resolve(content);
                    }
                    catch (err) {
                        reject(err);
                    }
                    finally {
                        frame.pop();
                    }
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Refresh the file object
     * @param {ExecutionContext} ecc The current callstack
     * @returns
     */
    async refreshAsync(ecc) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'readFileAsync', isAsync: true, callType: CallOrigin.Driver });

        return new Promise((resolve, reject) => {
            try {
                fs.stat(this.#physicalLocation, (err, stat) => {
                    stat = this.#manager.createNormalizedStats(this.#physicalLocation, stat || {}, err);
                    super.refreshAsync(stat);
                    resolve(true);
                    frame.pop();
                });
            }
            catch (err) {
                frame.pop();
                reject(err);
            }
        });
    }

    /**
     * Write to a file
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} args
     * @returns
     */
    async writeAsync(ecc, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'readFileAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (this.isDirectory)
                return this.writeDirectoryAsync(frame.branch(), ...args);
            else
                return this.writeFileAsync(frame.branch(), ...args);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Write an object as JSON to file
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} data
     * @param {any} options
     * @returns
     */
    async writeJsonAsync(ecc, data, options = { indent: true, encoding: 'utf8' }) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'writeJsonAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let exportText = '';
            if (options.indent) {
                if (typeof options.indent === 'number')
                    exportText = JSON.stringify(data, undefined, options.indent);
                else if (options.indent === true)
                    exportText = JSON.stringify(data, undefined, 3);
            }
            else
                exportText = JSON.stringify(data);

            return await this.writeFileAsync(frame.branch(), exportText, options);
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Write to one or more files in the directory.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string | Object.<string,string|Buffer|(string) => string>} fileNameOrContent
     * @param {any} options
     */
    async writeDirectoryAsync(ecc, fileNameOrContent, content, options = { encoding: 'utf8', flag: 'w' }) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'writeDirectoryAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let writes = [];

            if (typeof fileNameOrContent === 'object') {
                for (let [filename, data] of Object.entries(fileNameOrContent)) {
                    if (typeof filename === 'string') {
                        if (typeof data === 'function')
                            data = data(filename);

                        writes.push(this.writeDirectoryAsync(frame.branch(), filename, data, options));
                    }
                }
                await Promise.all(writes);
            }
            else if (typeof fileNameOrContent === 'string') {
                return fsPromises.writeFile(frame.branch(), fileNameOrContent, content, options);
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Write to a single file
     * @param {ExecutionContext} ecc The current callstack
     * @param {string | Buffer} content
     * @param {{ encoding?: string, flags?: string }} options
     */
    async writeFileAsync(ecc, content, options = { encoding: 'utf8', flag: 'w' }) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'writeFileAsync', isAsync: true, callType: CallOrigin.Driver });
        if (typeof options === 'string') {
            options = { flag: options };
        }
        return new Promise((resolve, reject) => {
            try {
                fs.writeFile(this.#physicalLocation, content, options, () => resolve(true));
            }
            catch (ex) {
                reject(ex);
            }
            finally {
                frame.pop();
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
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} pathIn The path to populate
     * @returns {Promise<{ directories: DiskFileObject[], files: DiskFileObject[]}>}
     */
    getDirectoryContentsAsync(ecc, pathIn) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getDirectoryContentsAsync', isAsync: true, callType: CallOrigin.Driver });
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
                        /**
                         * Get a filesystem object
                         * @param {string} fileName
                         * @returns {Promise<FileSystemObject>}
                         */
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
                    frame.pop();
                });
            }
            catch (e) {
                frame.pop();
                reject(e);
            }
        });
    }

    /**
     * Translate a physical or virtual path into useful information.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} pathIn
     * @returns {{ directory: string, name: string, physicalPath: string, relativePath: string, virtualPath: string }}
     */
    getPathInfo(ecc, pathIn) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getPathInfo', isAsync: false, callType: CallOrigin.Driver });
        try {
            if (pathIn.indexOf('..') > -1)
                throw new Error(`getPathInfo(): Path expression may not contain '..'`);

            //  Physical path
            if (pathIn.startsWith(this.root)) {
                let vp = this.getVirtualPath(frame.branch(), pathIn),
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
                return this.getPathInfo(frame.branch(), this.getRealPath(frame.branch(), pathIn));
            //  Relative virtual path
            else if (!pathIn.startsWith('/')) {
                let virtualPath = path.posix.join(this.mountPoint, pathIn);
                return this.getPathInfo(frame.branch(), this.getRealPath(frame.branch(), virtualPath));
            }
            else
                return new Error(`getPathInfo() Could not translate path expression: ${pathIn}`);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Convert the virtual path to a real path.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} exprIn The file expression to convert.
     * @returns {string} The absolute filesystem path.
     */
    getRealPath(ecc, exprIn) {
        let [frame, expr] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'getRealPath', isAsync: false, callType: CallOrigin.Driver });
        try {
            let result = path.join(this.root, expr);
            if (!result.startsWith(this.root))
                throw new Error(`Illegal access attempt: ${expr}`);
            return result;
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Translate an absolute path back into a virtual path.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} exprIn The absolute path to translate.
     * @returns {string|false} The virtual path if the expression exists in this filesystem or false if not.
     */
    getVirtualPath(ecc, exprIn) {
        /** @type {[ExecutionFrame, string ]} */
        let [frame, expr] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'getVirtualPath', isAsync: false, callType: CallOrigin.Driver });
        try {
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
        finally {
            frame?.pop();
        }
    }

    /**
     * Clone an object syncronously.
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemRequest} request The request to clone an object.
     * @param {any[]} args Constructor args to pass to the new object.
     * @returns {MUDObject|false} The newly cloned object.
     */
    async cloneObjectAsync(ecc, request, args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'cloneObjectAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let { file, type, instance } = driver.efuns.parsePath(ecc, request.fullPath),
                module = driver.cache.get(file);

            if (instance > 0)
                throw new Error(`cloneObject() cannot request a specific instance ID`);

            try {
                if (!module || !module.loaded) {
                    module = await driver.compiler.compileObjectAsync(frame.branch(), { file, args });
                }
                if (module) {
                    if (module.isVirtual)
                        return module.defaultExport;
                    return await module.createInstanceAsync(frame.branch(), type, false, args);
                }
            }
            catch (err) {
                logger.log('cloneObjectAsync() error:', err.message);
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Creates a directory
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemRequest} request
     * @param {any} flags
     */
    async createDirectoryAsync(ecc, request, flags) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'createDirectoryAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let fullPath = this.translatePath(frame.branch(), request.relativePath);
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
                    stat = await driver.fileManager.getObjectAsync(frame.branch(), dir);

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
        finally {
            frame.pop();
        }
    }

    /**
     * Generate a normalized stat object.
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} fullPath The full native path to the object.
     * @param {FileSystemObject} baseStat What information we CAN provide
     * @param {Error} err Any error associated with this request
     * @returns {FileSystemObject}} A basic stat object
     */
    createNormalizedStats(ecc, fullPath, baseStat = {}, err = false) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'createNormalizedStats', isAsync: true, callType: CallOrigin.Driver });
        try {
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

            let pathInfo = this.getPathInfo(frame.context, fullPath);
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
                mountPoint: this.mountPoint,
                mtime: getStatValue(baseStat.mtime, dt),
                mtimeMs: getStatValue(baseStat.mtimeMs, dt.getTime()),
                name: baseStat.name || pathInfo.name,
                path: pathInfo.virtualPath,
                size: getStatValue(baseStat.size, -1),
                rdev: getStatValue(baseStat.rdev, -1),
                fileSystemId: this.systemId,
                storageType: 'disk',
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
        finally {
            frame.pop();
        }
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
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemObject} data The base stat object returned by Node
     * @returns {FileSystemObject} Only files and directories are supported at the moment
     */
    createStatObject(ecc, data, physicalPath) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'createStatObject', isAsync: false, callType: CallOrigin.Driver });
        let result;

        try {
            result = new DiskFileObject(this.createNormalizedStats(frame.branch(), physicalPath, data), physicalPath, this);
        }
        catch (err) {
            result = new DiskFileObject(this.createNormalizedStats(frame.branch(), physicalPath, data, err), physicalPath, this);
        }
        return result;
    }

    /**
     * Removes a directory from the filesystem.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} relativePath The path of the directory to remove.
     * @param {any} flags TBD
     */
    async deleteDirectoryAsync(ecc, relativePath, flags) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'deleteDirectoryAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let fullPath = this.translatePath(frame.branch(), relativePath);
            return new Promise((resolve, reject) => {
                fs.rmdir(fullPath, { recursive: flags & 1 > 0 }, err => {
                    if (err) reject(err);
                    else resolve(true);
                });
            });
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Get a directory object
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemRequest} request The directory expression to fetch
     * @returns {Promise<FileSystemObject>} A directory object
     */
    async getDirectoryAsync(ecc, request) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getDirectoryAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let fullPath = this.translatePath(frame.branch(), request.relativePath),
                stats = await this.statAsync(frame.branch(), request);

            if (stats.exists && stats.isDirectory)
                return new DiskFileObject(stats, fullPath, this);
            else
                throw (`getDirectoryAsync(): ${stats.fullPath} is not a directory`);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Get a filesystem object.
     * @param {ExecutionContext} ecc 
     * @param {FileSystemRequest} request The filesystem request
     * @returns {Promise<FileSystemObject>} Returns a file object if the file is found.
     */
    async getFileAsync(ecc, request) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getFileAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let stats = await this.statAsync(frame.branch(), request),
                absolutePath = this.getRealPath(frame.branch(), request.relativePath);
            return new DiskFileObject(stats, absolutePath, this);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Get a filesystem object from the expression provided.
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemRequest} request The filesystem request
     * @returns {Promise<FileSystemObject>}
     */
    async getObjectAsync(ecc, request) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getObjectAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let stats = await this.statAsync(frame.branch(), request),
                absolutePath = this.getRealPath(frame.branch(), request.relativePath);
            return new DiskFileObject(stats, absolutePath, this);
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Gets a system file without the usual checks
     * @param {FileSystemRequest} request The request
     * @returns {Promise<FileSystemObject>} The system file (if found)
     */
    async readSystemFileAsync(ecc, request) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getObjectAsync', isAsync: true, callType: CallOrigin.Driver });
        return new Promise(async resolve => {
            let fullDiskPath = this.translatePath(frame.branch(), request.relativePath);
            fs.readFile(fullDiskPath, { encoding: 'utf8' }, (err, data) => {
                if (err)
                    resolve(false);
                else
                    resolve(efuns.stripBOM(data));
                frame.pop();
            });
        });
    }

    /**
     * Glob a directory
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemRequest} request The request
     * @param {string} relativePath The directory to search
     * @param {string} expr An expression to glob for
     * @param {Glob} options Options to control the operation
     * @returns {FileSystemObject[]} A collection of filesystem objects
     */
    async glob(ecc, relativePath, expr, options = 0) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getObjectAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let fullPath = this.translatePath(frame.branch(), relativePath);
            let regex = DiskFileSystem.createPattern(expr);

            /** @type {fs.Dirent[]} */
            let files = await this.readDirectory(frame.branch(), fullPath);
            return files
                .filter(fi => regex.test(fi.name))
                .map(fi => driver.fileManager.createObject(fi));
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Load an object
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemRequest} request The request
     * @param {FileSystemRequest} request
     * @param {any} args
     */
    async loadObjectAsync(ecc, request, args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'loadObjectAsync', isAsync: true, callType: CallOrigin.Driver, unguarded: true });
        try {
            let parts = driver.efuns.parsePath(frame.branch(), request.fullPath),
                module = driver.cache.get(parts.file),
                forceReload = !module || request.hasFlag(1);

            if (forceReload) {
                module = await driver.compiler.compileObjectAsync(frame.branch(), {
                    args,
                    file: parts.file,
                    reload: forceReload
                });
                if (!module)
                    throw new Error(`Failed to load module ${fullPath}`);
            }
            let result = module.getInstanceWrapper(parts);
            return result;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Query the filesystem
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemQuery} query
     */
    queryFileSystemAsync(ecc, query) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'queryFileSystemAsync', isAsync: true, callType: CallOrigin.Driver });
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

                        resolve(finalResults.map(o => {
                            if (o instanceof FileSystemObject)
                                return o;
                            else
                                return new DiskFileObject(o);
                        }));
                    }
                    catch (ex) {
                        reject(ex);
                    }
                });
                frame.pop();
                return;
            }
            catch (err) {
                reject(err);
            }
            frame.pop();
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
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemRequest} request The file being requested.
     * @returns {Promise<string>}
     */
    readFileAsync(ecc, request) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'readFileAsync', isAsync: true, callType: CallOrigin.Driver });
        return new Promise(async (resolve, reject) => {
            try {
                let fileObject = await this.getFileAsync(frame.branch(), request)
                resolve(await fileObject.readAsync(frame.branch()));
                return frame.pop();
            }
            catch (err) {
                reject(err);
            }
            frame.pop();
        });
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemRequest} request
     * @returns {Promise<FileSystemObject>}
     */
    async statAsync(ecc, request) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'statAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let fullPath = this.translatePath(frame.branch(), request.relativePath);
            let myp = new Promise((resolve, reject) => {
                try {
                    fs.stat(fullPath, (err, data) => {
                        let stat = this.createNormalizedStats(frame.branch(), fullPath, data, err);
                        resolve(stat);
                    });
                }
                catch (ex) {
                    reject(ex);
                }
            });
            let result = await myp;
            return result;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Translates a virtual path into an absolute path
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemRequest|string} request The virtual MUD path.
     * @returns {string} The absolute filesystem path.
     */
    translatePath(ecc, request) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'translatePath', callType: CallOrigin.Driver });
        try {
            if (typeof request === 'string') {
                if (request.startsWith(this.root) && request.indexOf('..') === -1)
                    return request;
                let result = path.join(this.root, request);
                if (!result.startsWith(this.root))
                    throw new Error('Access violation');
                return result;
            }
            else if (!request)
                throw new Error('Something went wrong');
            else
                return this.translatePath(frame.branch(), request.relativePath);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Write to a file
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemRequest} request The virtual MUD path.
     * @param {string|Buffer} content The content to write to file
     * @param {string|number} [flag] A flag indicating mode, etc
     * @param {string} [encoding] The optional encoding to use
     * @returns {boolean} Returns true on success.
     * @deprecated
     */
    async writeFileAsync(ecc, request, content, flag, encoding) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'writeFileAsync', isAsync: true, callType: CallOrigin.Driver }),
            fullPath = this.translatePath(frame.branch(), request.relativePath);

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
                    frame.pop();
                })
        });
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemRequest} request The file to write to
     * @param {object|string} content The content to write
     * @param {string} [encoding] The file encoding to use
     * @param {number} [indent] The amount to indent by (for pretty JSON)
     * @deprecated
     */
    async writeJsonAsync(ecc, request, content, encoding = 'utf8', indent = 3) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'writeJsonAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (typeof content !== 'string')
                content = JSON.stringify(content, undefined, indent || undefined);
            return await this.writeFileAsync(frame.branch(), request, content, 'w', encoding);
        }
        finally {
            frame.pop();
        }
    }
}

module.exports = DiskFileSystem;

