/*
 * A file system object represents a single object on a filesystem.  This 
 * may be a directory or a file or some other construct (possible a FIFO,
 * symlink, etc).  A filesystem object MUST contain the following:
 *   - A name (no slashes)
 *   - An absolute MUD path from the root
 *   - A filesystem ID to denote which filesystem on which the object exists
 *   - A parent file object
 */
const
    path = require('path'),
    yaml = require('js-yaml'),
    events = require('events'),
    SecurityFlags = require('../security/SecurityFlags');

const { NotImplementedError } = require('../ErrorTypes');

/**
 * The interface definition for ALL filesystem types
 */
class FileSystemObject extends events.EventEmitter {
    /**
     * Construct a FSO
     * @param {FileSystemObject} statInfo
     */
    constructor(statInfo, err = false) {
        super();
        this.#fileInfo = statInfo;
        this.#hasWrapper = false;
    }

    // #region Prive Properties

    /** @type {FileSystemObject} */
    #fileInfo;

    #hasWrapper;

    // #endregion

    // #region Properties

    /**
     * The ID of the filesystem this object lives on
     * @type {string} 
     */
    get fileSystemId() {
        return this.#fileInfo.fileSystemId || undefined;
    }

    get mountPoint() {
        return this.#fileInfo.mountPoint || undefined;
    }

    get atime() {
        return this.#fileInfo.atime || new Date(0);
    }

    get atimeMs() {
        return this.atime.getMilliseconds();
    }

    get baseName() {
        let p = this.path;
        let n = p.lastIndexOf('.');

        return n > -1 ? p.substring(0, n) : p;
    }

    get birthtime() {
        return this.#fileInfo.birthtime || new Date(0);
    }

    get birthtimeMs() {
        return this.birthtime.getMilliseconds();
    }

    get blksize() {
        return this.#fileInfo.blksize || 4096;
    }

    get blocks() {
        return this.#fileInfo.blocks;
    }

    get ctime() {
        return this.#fileInfo.ctime || new Date(0);
    }

    get ctimeMs() {
        return this.ctime.getMilliseconds();
    }

    get dev() {
        return this.#fileInfo.dev || -1;
    }

    get directory() {
        return this.#fileInfo.directory || undefined;
    }

    get exists() {
        return this.#fileInfo.exists;
    }

    get extension() {
        if (this.isFile) {
            let n = this.fullPath.lastIndexOf('.');
            if (n > 0) return this.fullPath.slice(n);
        }
        return '';
    }

    get fullPath() {
        return this.path;
    }

    get gid() {
        return this.#fileInfo.gid || -1;
    }

    get hasWrapper() {
        return this.#hasWrapper;
    }

    get ino() {
        return this.#fileInfo.ino || -1;
    }

    get isBlockDevice() {
        return this.#fileInfo.isBlockDevice || false;
    }

    get isCharacterDevice() {
        return this.#fileInfo.isCharacterDevice || false;
    }

    get isDirectory() {
        return this.#fileInfo.isDirectory || false;
    }

    get isFile() {
        return this.#fileInfo.isFile || false;
    }

    get isFIFO() {
        return this.#fileInfo.isFIFO || false;
    }

    get isReadOnly() {
        return this.#fileInfo.isReadOnly === true;
    }

    get isSocket() {
        return this.#fileInfo.isSocket || false;
    }

    get isSymbolicLink() {
        return this.#fileInfo.isSymbolicLink || false;
    }

    get isSystemFile() {
        return this.#fileInfo.isSystemFile || false;
    }

    get isSystemRequest() {
        return this.hasWrapper === false;
    }

    get isVirtual() {
        return false;
    }

    isWrapper() {
        return false;
    }

    get mode() {
        return this.#fileInfo.mode || -1;
    }

    get mtime() {
        return this.#fileInfo.mtime || new Date(0);
    }

    get mtimeMs() {
        return this.mtime.getMilliseconds();
    }

    get name() {
        return this.#fileInfo.name;
    }

    get parent() {
        //  Special case for root
        if (this.#fileInfo.path === '/')
            return false;
        else
            return path.posix.join(this.#fileInfo.path, '..');
    }

    /** @type {string} */
    get path() {
        return this.#fileInfo.path;
    }

    get rdev() {
        return this.#fileInfo.rdev || -1;
    }

    get size() {
        return this.#fileInfo.size || -1;
    }

    get uid() {
        return this.#fileInfo.uid || -1;
    }

    // #endregion

    // #region Methods

    async cloneObjectAsync(...args) {

    }

    /**
     * Compile or re-compile a MUD module 
     */
    async compileAsync() {
        return new Promise(async (resolve, reject) => {
            if (this.isDirectory)
                return reject(`Operation not supported: ${this.fullPath} is a directory.`);
            try {
                await driver.compiler.compileObjectAsync({
                    args: [],
                    file: this.fullPath,
                    reload: true
                }).catch(err => reject(err));

                resolve(true);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    configureWrapper(wrapper) {
        this.#hasWrapper = true;
    }

    /**
     * Convert a path expression if needed.
     * @param {string} expr The path expression to convert.
     */
    static convertPath(expr) {
        if (path.sep === path.posix.sep)
            return expr;

        // handle the edge-case of Window's long file names
        // See: https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file#short-vs-long-names
        expr = expr.replace(/^\\\\\?\\/, "");

        // convert the separators, valid since both \ and / can't be in a windows filename
        expr = expr.replace(/\\/g, '\/');

        // compress any // or /// to be just /, which is a safe oper under POSIX
        // and prevents accidental errors caused by manually doing path1+path2
        expr = expr.replace(/\/\/+/g, '\/');

        return expr;
    }

    async copyAsync(request) {
        throw new NotImplementedError('copyAsync', this);
    }

    async createDirectoryAsync(...args) {
    }

    /**
     * Generate a dummy stat.
     * @param {Error} err An error that occurred.
     * @param {FileSystemObject} baseStat What information we CAN provide
     * @param {Error} err Any error associated with this request
     * @returns {FileSystemObject}} A dummy stat file
     */
    static createDummyStats(baseStat, err = false, operation = 'unknown') {
        let dt = new Date(0);

        return Object.assign({
            atime: dt,
            atimeMs: dt.getTime(),
            birthtime: dt,
            birthtimeMs: dt.getTime(),
            blksize: 4096,
            blocks: 0,
            ctime: dt,
            ctimeMs: dt.getTime(),
            dev: -1,
            directory: baseStat.directory,
            error: err || new Error('Unknown error'),
            exists: false,
            fullPath: baseStat.path,
            gid: -1,
            ino: -1,
            nlink: -1,
            uid: -1,
            mode: -1,
            mtime: dt,
            mtimeMs: dt.getTime(),
            name: baseStat.name,
            path: baseStat.path || '',
            size: -1,
            rdev: -1,
            isBlockDevice: false,
            isCharacterDevice: false,
            isDirectory: false,
            isFIFO: false,
            isFile: false,
            isSocket: false,
            isSymbolicLink: false
        }, baseStat);
    }

    /**
     * Called to delete the object
     * @param {FileSystemRequest} request
     */
    async deleteAsync(request) {
        throw new NotImplementedError('deleteAsync', this);
    }

    /**
     * Called to delete the object
     * @param {FileSystemRequest} request
     */
    async deleteDirectoryAsync(request) {
        throw new NotImplementedError('deleteDirectoryAsync', this);
    }

    /**
     * Called to delete the object
     * @param {FileSystemRequest} request
     */
    async deleteFileAsync(request) {
        throw new NotImplementedError('deleteFileAsync', this);
    }

    /** 
     * Get the parent of this object.
     * @returns {Promise<DirectoryWrapper>}  Returns the parent object
     */
    async getParentAsync() {
        let parentPath = this.path === '/' ? '/' : path.posix.resolve(this.path, '..');
        return await driver.fileManager.getDirectoryAsync(parentPath);
    }

    /**
     * Calculate the relative path to this object from a destination
     * @param {string} expr
     */
    getRelativePath(expr) {
        if (this.fullPath.startsWith(expr))
            return this.fullPath.slice(expr.length + (expr.endsWith('/') ? 0 : 1));
        else
            return path.posix.relative(expr, this.fullPath.slice(1));
    }

    /**
     * Load an object from this file.
     * @param {FileSystemRequest} request
     * @param {any[]} args
     */
    async loadObjectAsync(request, args) {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.isDirectory)
                    throw new Error(`Operation not supported: ${this.fullPath} is a directory.`);
                let parts = driver.efuns.parsePath(request.fullPath),
                    module = driver.cache.get(parts.file),
                    forceReload = !module || request.hasFlag(1),
                    cloneOnly = request.hasFlag(2);

                if (forceReload) {
                    module = await driver.compiler.compileObjectAsync({
                        args,
                        file: parts.file + (parts.extension || ''),
                        reload: forceReload
                    });
                    if (!module)
                        return reject(new Error(`loadObjectAsync(): Failed to load module ${fullPath}`));
                }
                if (cloneOnly) {
                    let clone = await module.createInstanceAsync(parts.type, false, args);

                    if (!clone)
                        return reject(`loadObjectAsync(): Failed to clone object '${request.fullPath}'`);

                    return resolve(clone);
                }
                return resolve(module.getInstanceWrapper(parts));
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Maps a path relative to this object
     * @param {any} expr
     */
    mapPath(expr) {
        return path.posix.join(this.path, '..', FileSystemObject.convertPath(expr));
    }

    /**
     * 
     */
    async readDirectoryAsync() {
        throw new NotImplementedError('readDirectoryAsync');
    }

    /**
     * Refresh the information about this object
     */
    refreshAsync(stats) {
        this.#fileInfo = stats;
        return stats;
    }

    resolveRelativePath(expr) {
        return path.posix.resolve(this.isDirectory ? this.path : this.directory, expr);
    }

    async moveAsync(request) {
        throw new NotImplementedError('moveAsync', this);
    }

    /**
     * @param {FileOptions} options
     * @returns {Promise<string|Buffer>} 
     */
    async readAsync(options = {}) {
        throw new NotImplementedError('readAsync', this);
    }

    /**
     * Additional options
     * @param {FileOptions} options
     */
    readJsonAsync(options = {}) {
        return new Promise(async (resolve, reject) => {
            try {
                let localOptions = Object.assign({ encoding: 'utf8', stripBOM: true }, options);
                if (this.isDirectory) {
                    console.log('Reading json from a directory?');
                }
                await this.readAsync()
                    .then(
                        content => {
                            let ecc = driver.getExecution();
                            if (content) {
                                content = content.toString(localOptions.encoding);
                                if (localOptions.stripBOM) {
                                    content = driver.efuns.stripBOM(content);
                                }
                            }
                            if (typeof content === 'string') {
                                let result = JSON.parse(content);
                                return resolve(result);
                            }
                            else if (typeof content === 'object')
                                return resolve(content);
                            else
                                reject(new Error(`readJsonAsync(): Could not produce object`));
                        },
                        reason => reject(reason));
            }
            catch (ex) {
                reject(ex);
            }
        });
    }

    async readYamlAsync(options = {}) {
        return new Promise(async (resolve, reject) => {
            try {
                let content = await this.readAsync()
                    .catch(err => reject(err));

                let localOptions = Object.assign({ encoding: 'utf8', stripBOM: true }, options);

                if (content) {
                    content = content.toString(localOptions.encoding);
                    if (localOptions.stripBOM) {
                        content = driver.efuns.stripBOM(content);
                    }
                }
                if (typeof content === 'string') {
                    let result = yaml.safeLoad(content);
                    return resolve(result);
                }
                else if (typeof content === 'object')
                    return resolve(content);
                else
                    reject(new Error(`readYamlAsync(): Could not produce object`));
            }
            catch (ex) {
                reject(ex);
            }
        });
    }

    /**
     * Refresh cached data and return a new copy of the object
     */
    async refresh() {
        throw new NotImplementedError('refresh', this);
    }

    /**
     * Perform security constraints using the specified method
     * @param {string} checkName The method to invoke within the security manager
     */
    async valid(checkName) {
        return await driver.fileManager.securityManager[checkName](this);
    }

    async writeAsync() {

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

    async writeYamlAsync(data) {
        let test = yaml.dump(data, { sortKeys: true })
        return await this.writeFileAsync(test);
    }

    // #endregion
}

/**
 * An object that is returned when a file is not found; This may 
 * be used to create directories or files.
 */
class ObjectNotFound extends FileSystemObject {
    constructor(stat, request, err = undefined) {
        super(stat, request, err);
    }

    async createDirectoryAsync(request) {
        throw new NotImplementedError('createDirectoryAsync', this);
    }

    async createFileAsync(request) {
        throw new NotImplementedError('createFileAsync', this);
    }
}

class VirtualObjectFile extends FileSystemObject {
    constructor(stat, request) {
        super(stat,request);
    }

    get isVirtual() {
        return true;
    }

    /**
     * Load an object from this file.
     * @param {FileSystemRequest} request
     * @param {any[]} args
     */
    loadObjectAsync(request, args=[]) {
        return new Promise(async (resolve, reject) => {
            let parts = driver.efuns.parsePath(request.fullPath),
                module = driver.cache.get(parts.file),
                forceReload = !module || request.hasFlag(1),
                cloneOnly = request.hasFlag(2);

            if (forceReload) {
                module = await driver.compiler.compileObjectAsync({
                    args,
                    file: parts.file,
                    isVirtual: true,
                    reload: forceReload
                });
                if (!module)
                    return reject(new Error(`Failed to load module ${fullPath}`));
            }
            if (cloneOnly) {
                let clone = await module.createInstanceAsync(parts.type, false, args);

                if (!clone)
                    return reject(`loadObjectAsync(): Failed to clone object '${request.fullPath}'`);

                return resolve(clone);
            }
            return resolve(module.getInstanceWrapper(parts));
        });
    }
}

/** 
 * Wraps a filesystem object with security checks and such
 * !!! WARNING: IT IS VITAL THAT **ALL** NATIVE METHODS ARE
 * WRAPPED WITH SECURITY CHECKS !!!
 */
class FileWrapperObject extends FileSystemObject {
    /**
     * Wrap a native filesystem object
     * @param {FileSystemObject} nativeObject
     */
    constructor(nativeObject) {
        super(nativeObject);

        this.#instance = nativeObject;
        nativeObject.configureWrapper(this);
    }

    //#region Properties

    /**
     * The underlying, native object that needs protection
     * @type {FileSystemObject}
     */
    #instance;

    /**
     * The ID of the filesystem this object lives on
     * @type {string} 
     */
    get fileSystemId() {
        return this.#instance.fileSystemId || undefined;
    }

    get mountPoint() {
        return this.#instance.mountPoint || undefined;
    }

    get atime() {
        return this.#instance.atime || new Date(0);
    }

    get atimeMs() {
        return this.atime.getMilliseconds();
    }

    get baseName() {
        let n = this.path.lastIndexOf('.'),
            s = this.path.lastIndexOf('/');

        return n > s ? this.path.slice(0, n) : this.path.slice(0);
    }

    get birthtime() {
        return this.#instance.birthtime || new Date(0);
    }

    get birthtimeMs() {
        return this.birthtime.getMilliseconds();
    }

    get blksize() {
        return this.#instance.blksize || 4096;
    }

    get blocks() {
        return this.#instance.blocks;
    }

    get ctime() {
        return this.#instance.ctime || new Date(0);
    }

    get ctimeMs() {
        return this.ctime.getMilliseconds();
    }

    get dev() {
        return this.#instance.dev || -1;
    }

    get directory() {
        return this.#instance.directory || undefined;
    }

    get exists() {
        return this.#instance.exists;
    }

    get extension() {
        if (this.isFile) {
            let n = this.fullPath.lastIndexOf('.');
            if (n > 0) return this.fullPath.slice(n);
        }
        return '';
    }

    get fullPath() {
        return this.path;
    }

    get gid() {
        return this.#instance.gid || -1;
    }

    get ino() {
        return this.#instance.ino || -1;
    }

    get isBlockDevice() {
        return this.#instance.isBlockDevice || false;
    }

    get isCharacterDevice() {
        return this.#instance.isCharacterDevice || false;
    }

    get isDirectory() {
        return this.#instance.isDirectory || false;
    }

    get isFile() {
        return this.#instance.isFile || false;
    }

    get isFIFO() {
        return this.#instance.isFIFO || false;
    }

    get isReadOnly() {
        return this.#instance.isReadOnly === true;
    }

    get isSocket() {
        return this.#instance.isSocket || false;
    }

    get isSymbolicLink() {
        return this.#instance.isSymbolicLink || false;
    }

    get isSystemFile() {
        return this.#instance.isSystemFile || false;
    }

    get isSystemRequest() {
        return false;
    }

    get isVirtual() {
        return false;
    }

    isWrapper() {
        return true;
    }

    get mode() {
        return this.#instance.mode || -1;
    }

    get mtime() {
        return this.#instance.mtime || new Date(0);
    }

    get mtimeMs() {
        return this.mtime.getMilliseconds();
    }

    get name() {
        return this.#instance.name;
    }

    get parent() {
        return this.#instance.parent;
    }

    /** @type {string} */
    get path() {
        return this.#instance.path;
    }

    get rdev() {
        return this.#instance.rdev || -1;
    }

    get size() {
        return this.#instance.size || -1;
    }

    get uid() {
        return this.#instance.uid || -1;
    }

    //#endregion

    // #region Methods

    async appendFileAsync(content, options = { encoding: 'utf8' }) {
        if (await this.can(SecurityFlags.P_APPEND)) {
            return this.#instance.appendFileAsync(content, options);
        }
    }

    /**
     * Check to see if the action can be performed
     * @param {number} perm
     */
    async can(perm) {
        return driver.securityManager.can(this, perm);
    }

    async cloneObjectAsync(...args) {
        if (await this.can(SecurityFlags.P_LOADOBJECT)) {
            return this.#instance.cloneObjectAsync(...args);
        }
    }

    async compileAsync() {
        if (await this.can(SecurityFlags.P_LOADOBJECT)) {
            return this.#instance.compileAsync();
        }
    }

    configureWrapper(t) {
        //  Does nothing
    }

    async createDirectoryAsync(...args) {
        if (await this.can(SecurityFlags.P_CREATEDIR)) {
            return this.#instance.createDirectoryAsync(...args);
        }
    }

    /**
     * Delete the file
     */
    async deleteAsync(...args) {
        if (this.isDirectory) {
            return this.deleteDirectoryAsync(...args);
        }
        else
            return this.deleteFileAsync(...args);
    }

    /**
     * Delete a directory
     */
    async deleteDirectoryAsync(...args) {
        if (await this.can(SecurityFlags.P_DELETEDIR)) {
            return this.#instance.deleteDirectoryAsync(...args);
        }
    }


    async deleteFileAsync() {
        if (await this.can(SecurityFlags.P_DELETE)) {
            return this.#instance.deleteFileAsync();
        }
    }

    async getFileAsync(fileName) {
        return this.#instance.getObjectAsync(fileName);
    }

    async getObjectAsync(fileName) {
        if (this.isDirectory) {
            if (await this.can(SecurityFlags.P_LISTDIR))
                return this.driver.fileManager.wrapFileObject(this.#instance.getObjectAsync(fileName));
        }
        else {
            return this;
        }
    }

    emit() {
        //  In-game wrappers are not allowed to call
    }

    async readAsync(...args) {
        if (this.isDirectory)
            return this.readDirectoryAsync(...args);
        else
            return this.readFileAsync(...args);
    }

    /**
     * Read information from a directory
     * @returns {Promise<FileSystemObject[]>}
     */
    async readDirectoryAsync(...args) {
        if (this.can(SecurityFlags.P_LISTDIR)) {
            return this.#instance.readDirectoryAsync(...args);
        }
    }

    async readFileAsync(...args) {
        if (this.can(SecurityFlags.P_READ)) {
            return this.#instance.readFileAsync(...args);
        }
    }

    async refreshAsync(stat) {
        await this.#instance.refreshAsync();
        return this;
    }

    async writeAsync(...args) {
        if (this.isDirectory)
            return this.writeDirectoryAsync(...args);
        else
            return this.writeFileAsync(...args);
    }

    /**
     * Write to one or more files in the directory.
     * @param {string | Object.<string,string|Buffer|(string) => string>} fileNameOrContent
     * @param {any} options
     */
    async writeDirectoryAsync(fileNameOrContent, content, options = { encoding: 'utf8', flag: 'w' }) {
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
            let fso = this.getFileAsync(fileNameOrContent);
            return fso.writeFileAsync(content);
        }
    }

    /**
     * Write to a single file
     */
    async writeFileAsync(...args) {
        if (await this.can(SecurityFlags.P_WRITE)) {
            return this.#instance.writeFileAsync(...args);
        }
    }

    async writeJsonAsync(...args) {
        if (await this.can(SecurityFlags.P_WRITE)) {
            return this.#instance.writeJsonAsync(...args);
        }
    }

    async writeYamlAsync(...args) {
        if (await this.can(SecurityFlags.P_WRITE)) {
            return this.#instance.writeYamlAsync(...args);
        }
    }

    // #endregion
}

Object.seal(FileWrapperObject.prototype);

module.exports = {
    SecurityFlags,
    FileSystemObject,
    FileWrapperObject,
    ObjectNotFound,
    VirtualObjectFile
};
