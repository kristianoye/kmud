/// <reference path="../dts/GameServer.d.ts" />
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
    yaml = require('js-yaml')
    SecurityFlags = Object.freeze({
        /** May read the contents of an object */
        P_READ: 1 << 0,
        /** May write/overwrite the object; Also see P_APPEND */
        P_WRITE: 1 << 1,
        /** May delete the object */
        P_DELETE: 1 << 2,
        /** May delete this directory */
        P_DELETEDIR: 1 << 3,
        /** May read the contents of a directory */
        P_LISTDIR: 1 << 4,
        /** May create a file in the directory */
        P_CREATEFILE: 1 << 5,
        /** May create a new directory */
        P_CREATEDIR: 1 << 6,
        /** May change permissions on an object */
        P_CHANGEPERMS: 1 << 7,
        /** May view the permissions on an object */
        P_READPERMS: 1 << 8,
        /** May take ownership of an object */
        P_TAKEOWNERSHIP: 1 << 9,
        /** Can you read the associated metadata? */
        P_READMETADATA: 1 << 10,
        /** Can you write to the associated metadata? */
        P_WRITEMETADATA: 1 << 11,
        /** Can the user read filesystem files? */
        P_VIEWSYSTEMFILES: 1 << 12,
        /** Can the user load types from the file module? */
        P_LOADOBJECT: 1 << 13,
        /** Can the user execute the type as a command? */
        P_EXECUTE: 1 << 14,
        /** Can the user destruct the objects created from the module? */
        P_DESTRUCTOBJECT: 1 << 15,
        /** May append but may not be able to truncate */
        P_APPEND: 1 << 16
    });

const { NotImplementedError, PermissionDeniedError } = require('../ErrorTypes');

/**
 * The interface definition for ALL filesystem types
 */
class FileSystemObject {
    /**
     * Construct a FSO
     * @param {FileSystemObject} fso
     */
    constructor(fso, err = false) {
        this.#fileInfo = fso;
    }

    // #region Prive Properties

    /** @type {FileSystemObject} */
    #fileInfo;

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

    get isSocket() {
        return this.#fileInfo.isSocket || false;
    }

    get isSymbolicLink() {
        return this.#fileInfo.isSymbolicLink || false;
    }

    get isSystemFile() {
        return this.#fileInfo.isSystemFile || false;
    }

    get isVirtual() {
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

    /**
     * Compile or re-compile a MUD module 
     */
    async compileAsync() {
        return new Promise(async (resolve, reject) => {
            if (this.isDirectory)
                throw new Error(`Operation not supported: ${this.fullPath} is a directory.`);
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
     * Get the parent of this object.
     * @returns {Promise<DirectoryWrapper>}  Returns the parent object
     */
    async getParent() {
        let parentPath = this.path === '/' ? '/' : path.posix.resolve(this.path, '..');
        return await driver.fileManager.getObjectAsync(parentPath);
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
     * Refresh the information about this object
     */
    async refreshAsync() {
        let stats = await driver.fileManager.getObjectAsync(this.path);

        this.#fileInfo = stats;
        return stats;
    }

    resolveRelativePath(expr) {
        return path.posix.resolve(this.isDirectory ? this.path : this.directory, expr);
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
                this.readAsync()
                    .then(
                        content => {
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
                let content = await this.#fileInfo.readAsync()
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


module.exports = {
    FileSystemObject,
    ObjectNotFound,
    SecurityFlags,
    VirtualObjectFile
};
