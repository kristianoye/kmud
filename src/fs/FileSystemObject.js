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
    SecurityFlags = require('../security/SecurityFlags'),
    { NotImplementedError, SecurityError } = require('../ErrorTypes'),
    CompilerFlags = require('../compiler/CompilerFlags'),
    { ExecutionContext, CallOrigin } = require('../ExecutionContext');

/**
 * Remove any unsafe parameters from a MUD file request
 * @param {ICommonFileParms} opts Options to prep
 * @param {ICommonFileParms} defaults Options to augment original with
 */
function safeOptions(opts, defaults = { encoding: 'utf8' }) {
    if (typeof opts === 'object') {
        return { ...defaults, ...opts, isSystemRequest: false };
    }
    return opts;
}

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

    exists() {
        return this.#fileInfo.exists();
    }

    get extension() {
        if (this.isFile()) {
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

    isBlockDevice() {
        return this.#fileInfo.isBlockDevice() || false;
    }

    isCharacterDevice() {
        return this.#fileInfo.isCharacterDevice() || false;
    }

    isDirectory() {
        return this.#fileInfo.isDirectory() || false;
    }

    isFile() {
        return this.#fileInfo.isFile() || false;
    }

    isFIFO() {
        return this.#fileInfo.isFIFO() || false;
    }

    isLoadable() {
        if (this.isFile()) {
            let ext = this.extension,
                re = new RegExp(driver.compiler.extensionPattern);
            return re.test(ext);
        }
        return false;
    }

    isLoaded() {
        let result = driver.cache.get(this.fullPath);
        return !!result;
    }

    isReadOnly() {
        return this.#fileInfo.isReadOnly();
    }

    isSocket() {
        return this.#fileInfo.isSocket || false;
    }

    isSymbolicLink() {
        return this.#fileInfo.isSymbolicLink || false;
    }

    isSystemFile() {
        return this.#fileInfo.isSystemFile || false;
    }

    isSystemRequest() {
        return true;
    }

    isVirtual() {
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

    async getGroupName() {
        let [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'getGroupName', isAsync: true, callType: CallOrigin.Driver }, true);
        try {
            return await driver.securityManager.getGroupName(frame.context, this);
        }
        finally {
            frame?.pop();
        }
    }

    async getOwnerName() {
        let [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'getOwnerName', isAsync: true, callType: CallOrigin.Driver }, true);
        try {
            return await driver.securityManager.getOwnerName(frame.context, this);
        }
        finally {
            frame?.pop();
        }
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

    /**
     * Get the string representation of the object's permissions to this object
     * @returns {string}
     */
    async getPermString() {
        /** @type {[ ExecutionContext, typeof import('../MUDObject') ]} */
        const [frame, player] = ExecutionContext.tryPushFrame(arguments, { method: 'getPermString', callType: CallOrigin.Driver, isAsync: true, className: FileSystemObject });
        try {
            return await driver.securityManager.getPermString(frame.context, this, player || driver.efuns.thisPlayer(frame.context));
        }
        finally {
            frame?.pop();
        }
    }

    get rdev() {
        return this.#fileInfo.rdev || -1;
    }

    get size() {
        return this.#fileInfo.size || -1;
    }


    /**
     * Describes what mechanism holds the data in the backend
     * @returns {string}
     */
    get storageType() {
        return this.#fileInfo.storageType;
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
    async compileAsync(options = {}) {
        return new Promise(async (resolve, reject) => {
            if (this.isDirectory())
                return reject(`Operation not supported: ${this.fullPath} is a directory.`);
            try {
                let compilerOptions = Object.assign({
                    args: [],
                    reload: true
                }, options, { file: this.fullPath });
                let result = await driver.compiler.compileObjectAsync(compilerOptions);
                resolve(result.defaultExport || true);
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

    /**
     * 
     * @param {any} request
     */
    async copyAsync(request) {
        throw new NotImplementedError('copyAsync', this);
    }

    async createDirectoryAsync(...args) {
        throw new NotImplementedError('createDirectoryAsync');
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
            exists: () => false,
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
            isBlockDevice: () => false,
            isCharacterDevice: () => false,
            isDirectory: () => false,
            isFIFO: () => false,
            isFile: () => false,
            isSocket: () => false,
            isSymbolicLink: () => false,
            isSystemFile: () => false,
            isVirtual: () => false,
        }, baseStat);
    }

    createReadStream(options) {
        throw new NotImplementedError('createReadStream');
    }

    createWriteStream(options) {
        throw new NotImplementedError('createWriteStream');
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
     * @returns {Promise<boolean>}
     */
    async deleteDirectoryAsync(request) {
        throw new NotImplementedError('deleteDirectoryAsync', this);
    }

    /**
     * Called to delete the object
     * @param {FileSystemObject} request
     */
    async deleteFileAsync(request) {
        throw new NotImplementedError('deleteFileAsync', this);
    }

    /** 
     * Get the parent of this object.
     * @param {ExecutionContext} ecc The current call stack
     * @returns {Promise<FileSystemObject>}  Returns the parent object
     */
    async getParentAsync(ecc) {
        let frame = ecc.push({ file: __filename, method: 'getParentAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let parentPath = this.path === '/' ? '/' : path.posix.resolve(this.path, '..');
            return await driver.fileManager.getObjectAsync(frame.branch(), parentPath);
        }
        finally {
            frame.pop();
        }
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
     * Is this object empty?
     * @returns {boolean}
     */
    async isEmpty() {
        throw new NotImplementedError('isEmpty');
    }

    /**
     * Load an object from this file.
     * @param {ExecutionContext} ecc The callstack
     * @param {number} flags
     * @param {any[]} args
     */
    async loadObjectAsync(ecc, flags = 0, args = [], fileParts = false) {
        let frame = ecc.push({ file: __filename, method: 'loadObjectAsync', isAsync: true, callType: CallOrigin.Driver, unguarded: true });
        try {
            if (this.isDirectory())
                throw new Error(`Operation not supported: ${this.fullPath} is a directory.`);
            let parts = fileParts || driver.efuns.parsePath(frame.context, this.fullPath),
                module = driver.cache.get(parts.file),
                forceReload = !module || (flags & 1) > 0,
                cloneOnly = (flags & 2) > 0;

            if (forceReload) {
                module = await driver.compiler.compileObjectAsync(frame.branch(), {
                    args,
                    file: parts.file,
                    reload: forceReload
                });
                if (!module)
                    throw new Error(`loadObjectAsync(): Failed to load module ${fullPath}`);
            }
            if (cloneOnly) {
                let clone = await module.createInstanceAsync(frame.branch(), parts.type, false, args);

                if (!clone)
                    throw new Error(`loadObjectAsync(): Failed to clone object '${this.fullPath}'`);

                return clone;
            }
            return module.getInstanceWrapper(parts);
        }
        finally {
            frame.pop();
        }
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
     * Read directory contents
     * @returns {Promise<FileSystemObject[]}
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
        return path.posix.resolve(this.isDirectory() ? this.path : this.directory, expr);
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
     * @param {ExecutionContext} ecc The callstack
     * @param {FileOptions} options
     */
    async readJsonAsync(ecc, options = {}) {
        let frame = ecc.push({ file: __filename, method: 'readJsonAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let localOptions = Object.assign({ encoding: 'utf8', stripBOM: true }, options);
            if (this.isDirectory()) {
                console.log('Reading json from a directory?');
            }
            let content = await this.readAsync(frame.branch());
            if (content) {
                content = content.toString(localOptions.encoding);
                if (localOptions.stripBOM) {
                    content = driver.efuns.stripBOM(frame.context, content);
                }
            }
            if (typeof content === 'string') {
                let result = JSON.parse(content);
                return result;
            }
            else if (typeof content === 'object')
                return content;
            else
                throw new Error(`readJsonAsync(): Could not produce object`);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The callstack
     * @param {any} options
     * @returns
     */
    async readYamlAsync(ecc, options = {}) {
        let frame = ecc.push({ file: __filename, method: 'readYamlAsync', isAsync: true, callType: CallOrigin.Driver });
        return new Promise(async (resolve, reject) => {
            try {
                let content = await this.readFileAsync(frame.branch());

                let localOptions = Object.assign({ encoding: 'utf8', stripBOM: true }, options);

                if (content) {
                    content = content.toString(localOptions.encoding);
                    if (localOptions.stripBOM) {
                        content = driver.efuns.stripBOM(frame.branch(), content);
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
            finally {
                frame.pop();
            }
        });
    }

    async writeAsync() {

    }

    /**
     * 
     * @param {any} ecc
     * @param {any} dataIn
     * @param {any} optionsIn
     */
    async writeJsonAsync(ecc, dataIn, optionsIn = { indent: true, encoding: 'utf8' }) {
        let [frame, data, options] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'writeJsonAsync', isAsync: true, callType: CallOrigin.Driver });
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

            await this.writeFileAsync(exportText, options);
        }
        finally {
            frame?.pop();
        }
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
        super(stat, request);
    }

    get isVirtual() {
        return true;
    }

    /**
     * Load an object from this file.
     * @param {ExecutionContext} ecc The current callstack
     * @param {FileSystemRequest} request
     * @param {any[]} args
     */
    async loadObjectAsync(ecc, request, args = []) {
        let frame = ecc.push({ file: __filename, method: 'loadObjectAsync', isAsync: true, callType: CallOrigin.Driver, unguarded: true });
        try {
            let parts = driver.efuns.parsePath(frame.context, request.fullPath),
                module = driver.cache.get(parts.file),
                forceReload = !module || request.hasFlag(1),
                cloneOnly = request.hasFlag(2);

            if (forceReload) {
                module = await driver.compiler.compileObjectAsync(frame.branch(), {
                    args,
                    file: parts.file,
                    isVirtual: true,
                    reload: forceReload
                });
                if (!module)
                    throw new Error(`Failed to load module ${parts.file}`);
            }
            if (cloneOnly) {
                let clone = await module.createInstanceAsync(parts.type, false, args);

                if (!clone)
                    return reject(`loadObjectAsync(): Failed to clone object '${request.fullPath}'`);

                return clone;
            }
            return module.getInstanceWrapper(parts);
        }
        finally {
            frame.pop();
        }
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

    exists() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'exists', lineNumber: __line, isAsync: false, className: FileSystemObject, callType: CallOrigin.Driver });
        try {
            return this.#instance.exists();
        }
        finally {
            frame?.pop();
        }
    }

    get extension() {
        if (this.isFile()) {
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

    isBlockDevice() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isBlockDevice', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            return this.#instance.isBlockDevice() || false;
        }
        finally {
            frame?.pop();
        }
    }

    isCharacterDevice() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isCharacterDevice', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        driver
        try {
            return this.#instance.isCharacterDevice() || false;
        }
        finally {
            frame.pop();
        }
    }

    isDirectory() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isDirectory', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            return this.#instance.isDirectory() || false;
        }
        finally {
            frame?.pop();
        }
    }

    isFile() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isFile', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            return this.#instance.isFile() || false;
        }
        catch (err) {
            frame.error = err;
        }
        finally {
            frame?.pop();
        }
    }

    isFIFO(ecc) {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isFIFO', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            return this.#instance.isFIFO() || false;
        }
        finally {
            frame?.pop();
        }
    }


    isLoadable() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isLoadable', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            if (this.isFile()) {
                let ext = this.extension,
                    re = new RegExp(driver.compiler.extensionPattern);
                return re.test(ext);
            }
            return false;
        }
        finally {
            frame?.pop();
        }
    }

    isLoaded() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isLoaded', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            let result = driver.cache.get(this.fullPath);
            return !!result;
        }
        finally {
            frame?.pop();
        }
    }


    isReadOnly() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isReadOnly', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            return this.#instance.isReadOnly() === true;
        }
        finally {
            frame?.pop();
        }
    }

    isSocket() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isSocket', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            return this.#instance.isSocket() || false;
        }
        finally {
            frame?.pop();
        }
    }

    isSymbolicLink() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isSocket', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            return this.#instance.isSymbolicLink();
        }
        finally {
            frame?.pop();
        }
    }

    isSystemFile() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isSystemFile', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            return this.#instance.isSystemFile() || false;
        }
        finally {
            frame?.pop();
        }
    }

    isSystemRequest() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isSystemRequest', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            return false;
        }
        finally {
            frame?.pop();
        }
    }

    isVirtual() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isVirtual', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            return false;
        }
        finally {
            frame?.pop();
        }
    }

    isWrapper() {
        const [frame] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'isWrapper', lineNumber: __line, isAsync: false, className: FileWrapperObject, callType: CallOrigin.Driver });
        try {
            return true;
        }
        finally {
            frame?.pop();
        }
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

    get storageType() {
        return this.#instance.storageType;
    }

    get uid() {
        return this.#instance.uid || -1;
    }

    //#endregion

    // #region Methods

    /**
     * Append text to the end of the file
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} content
     * @param {any} options
     * @returns
     */
    async appendFileAsync(ecc, content, options = { encoding: 'utf8' }) {
        let frame = ecc.push({ file: __filename, method: 'appendFileAsync', isAsync: true });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_WRITE)) {
                return await this.#instance.appendFileAsync(frame.branch(), content, options);
            }
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Check to see if the action can be performed
     * @param {ExecutionContext} ecc The current callstack
     * @param {number} perm
     * @param {string} methodName
     */
    async can(ecc, perm, methodName = 'unknown') {
        let frame = ecc.push({ file: __filename, method: 'can', isAsync: true });
        try {
            let result = await driver.securityManager.can(frame.branch(), this, perm, methodName);
            if (result !== true)
                throw new SecurityError('Unknown security reason');
            return true;
        }
        catch (err) {
            if (err instanceof SecurityError) {
                let lastFrame = ecc._callstack[1];
                throw new SecurityError(`${lastFrame.method}: Permission denied`, err);
            }
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Clone an existing object
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} args
     * @returns
     */
    async cloneObjectAsync(ecc, ...args) {
        let frame = ecc.push({ file: __filename, method: 'cloneObjectAsync', isAsync: true });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_LOADOBJECT)) {
                return this.#instance.cloneObjectAsync(...args);
            }
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} options
     * @returns
     */
    async compileAsync(ecc, options = {}) {
        let frame = ecc.push({ file: __filename, method: 'compileAsync', isAsync: true });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_LOADOBJECT)) {
                return this.#instance.compileAsync(ecc, safeOptions(options));
            }
            throw new Error(`Permission denied: Could not compile ${this.fullPath}`);
        }
        finally {
            frame.pop();
        }
    }

    configureWrapper(ecc, t) {
        let frame = ecc.push({ file: __filename, method: 'configureWrapper', isAsync: true });
        frame.pop();
    }

    /**
     * Copy this file object to another location
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} dest
     * @param {any} flags
     * @returns
     */
    async copyAsync(ecc, dest, flags = 0) {
        let frame = ecc.push({ file: __filename, method: 'copyAsync', isAsync: true });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_READ, 'copyAsync')) {
                return this.#instance.copyAsync(dest, flags);
            }
            throw new SecurityError(`${this.fullPath}: copyAsync(): Permission denied`);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Create this object as a directory if it does not exist
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} ecc
     * @param {...any} args
     * @returns
     */
    async createDirectoryAsync(ecc, ...args) {
        let frame = ecc.push({ file: __filename, method: 'createDirectoryAsync', isAsync: true });
        try {
            if (await this.can(ecc, SecurityFlags.P_CREATEDIR)) {
                return this.#instance.createDirectoryAsync(ecc, ...args);
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Creeate a read stream
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} options
     * @returns
     */
    async createReadStream(ecc, options) {
        let frame = ecc.push({ file: __filename, method: 'createReadStream', isAsync: true });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_READ, 'createReadStream')) {
                return this.#instance.createReadStream(options);
            }
            else
                throw new SecurityError(`${this.fullPath}: createReadStream(): Permission denied`);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Create an configuration object to pass to compiler (TODO: Make an efun for this)
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} options
     * @returns
     */
    static createSafeCompilerOptions(ecc, options) {
        let frame = ecc.push({ file: __filename, method: 'createSafeCompilerOptions' });
        try {
            return {
                file: this.fullPath,
                flags: (options.flags || 0) & CompilerFlags.SafeFlags,
                onCompilerStageExecuted: typeof options.onCompilerStageExecuted === 'function' && options.onCompilerStageExecuted,
                onDebugOutput: typeof options.onDebugOutput === 'function' && options.onDebugOutput,
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Create a writeable stream for methods like pipe()
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} options
     * @returns
     */
    async createWriteStream(ecc, options) {
        let frame = ecc.push({ file: __filename, method: 'createWriteStream', isAsync: true });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_WRITE, 'createWriteStream')) {
                return this.#instance.createWriteStream(options);
            }
            else
                throw new SecurityError(`${this.fullPath}: createWriteStream(): Permission denied`);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Delete the file
     * @param {ExecutionContext} ecc The current callstack
     */
    async deleteAsync(ecc, ...args) {
        let frame = ecc.push({ file: __filename, method: 'deleteAsync', isAsync: true });
        try {
            if (this.isDirectory()) {
                return this.deleteDirectoryAsync(frame.branch(), ...args);
            }
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
     */
    async deleteDirectoryAsync(ecc, ...args) {
        let frame = ecc.push({ file: __filename, method: 'deleteDirectoryAsync', isAsync: true });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_DELETEDIR)) {
                return this.#instance.deleteDirectoryAsync(frame.branch(), ...args);
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Delete this object if it is a file
     * @param {ExecutionContext} ecc The current callstack
     * @returns
     */
    async deleteFileAsync(ecc) {
        let frame = ecc.push({ file: __filename, method: 'deleteFileAsync', isAsync: true });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_DELETE)) {
                return this.#instance.deleteFileAsync(frame.branch());
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Get a file object
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} fileName
     * @returns
     */
    async getFileAsync(ecc, fileName) {
        let frame = ecc.push({ file: __filename, method: 'getFileAsync', isAsync: true });
        try {
            return this.#instance.getObjectAsync(frame.branch(), fileName);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Get a file object relative to this object
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} fileName
     * @returns
     */
    async getObjectAsync(ecc, fileName) {
        let frame = ecc.push({ file: __filename, method: 'getObjectAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (this.isDirectory()) {
                if (await this.can(frame.branch(), SecurityFlags.P_LISTDIR))
                    return this.driver.fileManager.wrapFileObject(this.#instance.getObjectAsync(frame.branch(), fileName));
            }
            else {
                return this;
            }
        }
        finally {
            frame.pop();
        }
    }

    emit() {
        //  In-game wrappers are not allowed to call
    }

    /**
     * Determine if the file/directory is empty
     * @param {ExecutionContext} ecc The current callstack
     * @returns
     */
    async isEmpty(ecc) {
        let frame = ecc.push({ method: 'isEmpty', isAsync: true, callType: CallOrigin.Driver });
        try {
            await this.refreshAsync(frame.branch());
            if (this.isDirectory()) {
                let files = await this.readAsync(frame.branch());
                return Array.isArray(files) && files.length === 0;
            }
            else if (this.isFile()) {
                return this.size === 0;
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} args
     */
    async loadObjectAsync(ecc, ...args) {
        let frame = ecc.push({ file: __filename, method: 'loadObjectAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_LOADOBJECT, 'loadObjectAsync')) {
                return await this.#instance.loadObjectAsync(frame.branch(), ...args);
            }
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} args
     * @returns
     */
    async readAsync(ecc, ...args) {
        let frame = ecc.push({ file: __filename, method: 'readAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (this.isDirectory())
                return await this.readDirectoryAsync(frame.branch(), ...args);
            else
                return await this.readFileAsync(frame.branch(), ...args);
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Read information from a directory
     * @param {ExecutionContext} ecc The current callstack
     * @returns {Promise<FileSystemObject[]>}
     */
    async readDirectoryAsync(ecc, ...args) {
        let frame = ecc.push({ file: __filename, method: 'readDirectoryAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_LISTDIR, 'readDirectoryAsync')) {
                const results = await this.#instance.readDirectoryAsync(frame.branch(), ...args);
                if (Array.isArray(results)) {
                    return results.map(file => {
                        if (file instanceof FileWrapperObject)
                            return file;
                        else
                            return new FileWrapperObject(file)
                    });
                }
                return results;
            }
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Read the file content
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} args
     * @returns
     */
    async readFileAsync(ecc, ...args) {
        let frame = ecc.push({ file: __filename, method: 'readFileAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_READ, 'readFileAsync')) {
                return await this.#instance.readFileAsync(frame.branch(), ...args);
            }
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Refresh the object information
     * @param {ExecutionContext} ecc The current callstack
     * @returns
     */
    async refreshAsync(ecc) {
        let frame = ecc.push({ file: __filename, method: 'refreshAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let stat = await driver.fileManager.getObjectAsync(frame.branch(), this.fullPath, 0, true);
            this.#instance = stat;
            return this;
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Refresh the object information
     * @param {ExecutionContext} ecc The current callstack
     * @returns {Promise<boolean>}
     */
    async writeAsync(ecc, ...args) {
        let frame = ecc.push({ file: __filename, method: 'writeAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (this.isDirectory())
                return this.writeDirectoryAsync(frame.branch(), ...args);
            else
                return this.writeFileAsync(frame.branch(), ...args);
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
        let frame = ecc.push({ file: __filename, method: 'writeDirectoryAsync', isAsync: true, callType: CallOrigin.Driver });
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
                let fso = await this.getObjectAsync(frame.branch(), fileNameOrContent);
                return fso.writeFileAsync(frame.branch(), content);
            }
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Write to a single file
     * @param {ExecutionContext} ecc The current callstack
     */
    async writeFileAsync(ecc, ...args) {
        let frame = ecc.push({ file: __filename, method: 'writeFileAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_WRITE, 'writeFileAsync')) {
                return this.#instance.writeFileAsync(frame.branch(), ...args);
            }
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Write a JSON-serialized object to file
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} args
     * @returns
     */
    async writeJsonAsync(ecc, ...args) {
        let frame = ecc.push({ file: __filename, method: 'writeJsonAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_WRITE, 'writeJsonAsync')) {
                return this.#instance.writeJsonAsync(frame.branch(), ...args);
            }
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Write a YAML-serialized object to file
     * @param {ExecutionContext} ecc The current callstack
     * @param {...any} args
     * @returns
     */
    async writeYamlAsync(ecc, ...args) {
        let frame = ecc.push({ file: __filename, method: 'writeYamlAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_WRITE, 'writeYamlAsync')) {
                return this.#instance.writeYamlAsync(frame.branch(), ...args);
            }
        }
        finally {
            frame.pop(true);
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
