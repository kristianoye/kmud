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
    path = require('path');

const { NotImplementedError } = require('../ErrorTypes');

class FileSystemObject {
    /**
     * Construct a new stat
     * @param {FileSystemObject} data Config data
     * @param {FileSystemRequest} request The directory the filesystem is mounted to
     * @param {Error} err Any error associated with fetching the object
     */
    constructor(data, request, err) {

        Object.assign(this, data);

        if (!(this.directory = data.directory))
            throw new Error('FileSystemObject must contain directory');
        this.error = err;
        this.fullPath = '';
        this.isFile = data.isFile;
        this.isDirectory = data.isDirectory;
        this.mountPoint = data.mountPoint;
        this.fileSystemId = data.fileSystemId;
        this.relativePath = data.relativePath;
        this.name = data.name;

        if (request) {
            this.mountPoint = request.fileSystem.mountPoint;
            this.fileSystemId = request.fileSystem.systemId;

            /** Path relative to the root of the filesystem */
            this.relativePath = request.relativePath;
            this.name = data.name || request.fileName;
        }
    }

    assertValid() {
        if (!this.name)
            throw new Error('Illegal stat object has no name');
        return this;
    }

    /**
     * Creates a deep clone of the stat that is safe to return to the MUD.
     */
    clone() {
        return new this.constructor(this);
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
     * @param {FileSystemRequest} request The request associated with this stat
     * @param {Error} err Any error associated with this request
     * @returns {FileSystemObject}} A dummy stat file
     */
    static createDummyStats(request, err = false) {
        let dt = new Date(0);

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
            directory: request.directory,
            error: err || new Error('Unknown error'),
            exists: false,
            fullPath: request.fullPath,
            gid: -1,
            ino: -1,
            nlink: -1,
            uid: -1,
            mode: -1,
            mtime: dt,
            mtimeMs: dt.getTime(),
            name: request.name,
            path: request.path || '',
            size: -1,
            rdev: -1,
            isBlockDevice: false,
            isCharacterDevice: false,
            isDirectory: false,
            isFIFO: false,
            isFile: false,
            isSocket: false,
            isSymbolicLink: false
        };
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
     * @returns {Promise<DirectoryObject>}  Returns the parent object
     */
    async getParent() {
        try {
            if (this.path === '/')
                return undefined;
            let parentPath = path.posix.resolve(this.path, '..');
            return await driver.fileManager.getDirectoryAsync(parentPath)
                .catch(err => { throw err; });
        }
        catch (err) {
            throw err;
        }
    }

    /** Get the permissions from the security manager */
    async getPermissions() {
        let securityManager = driver.securityManager;
        return securityManager.getPermissions(this);
        if (this.isFile) {
            let parent = await this.getParent();
            return await parent.getPermissions(this.name);
        }
        else if (this.isDirectory) {
            let aclFile = path.posix.resolve(this.path, '.acl'),
                aclStat = await driver.fileManager.statAsync(aclFile);

            if (aclStat.exists) {
                let aclData = await aclStat.readJsonAsync();
                return aclData;
            }
            else {
                let parent = await this.getParent();
                return await parent.getPermissions();
            }
        }
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
     * @param {FileSystemObject} data
     * @returns {FileSystemObject}
     */
    merge(data) {
        /** @type {number} */
        this.atime = data.atime || this.atime || 0;

        /** @type {number} */
        this.blocks = data.blocks || this.blocks || 0;

        /** @type {number} */
        this.blockSize = data.blockSize || this.blockSize || 0;

        /** @type {number} */
        this.ctime = data.ctime || this.ctime || 0;

        /** @type {number} */
        this.dev = data.dev || this.dev || 0;

        /** @type {boolean} */
        this.exists = data.exists || this.exists || false;

        /** @type {boolean} */
        this.isDirectory = data.isDirectory || this.isDirectory || false;
        if (typeof this.isDirectory === 'function')
            this.isDirectory = data.isDirectory();

        /** @type {boolean} */
        this.isFile = data.isFile || this.isFile || false;
        if (typeof this.isFile === 'function')
            this.isFile = data.isFile();

        /** @type {number} */
        this.mtime = data.mtime || this.mtime || 0;

        /** @type {string} */
        this.name = data.name || this.name || false;

        /** @type {FileSystemObject} */
        this.parent = data.parent || this.parent || false;

        /** @type {string} */
        this.path = data.path || this.parent + this.name;

        /** @type {Object.<string,number>} */
        this.perms = data.perms || this.perms || {};

        /** @type {number} */
        this.size = data.size || this.size || 0;

        /** @type {number} */
        this.type = data.type || this.type || FT_UNKNOWN;

        return this;
    }

    async moveAsync(request) {
        throw new NotImplementedError('moveAsync', this);
    }

    async readAsync() {
        throw new NotImplementedError('readAsync', this);
    }

    /**
     * Refresh cached data and return a new copy of the object
     */
    refresh() {
        throw new NotImplementedError('refresh', this);
    }

    /**
     * Perform security constraints using the specified method
     * @param {string} checkName The method to invoke within the security manager
     */
    async valid(checkName) {
        return await driver.fileManager.securityManager[checkName](this);
    }
}

/**
 * Abstract class for implementing a directory-like structure 
 */
class DirectoryObject extends FileSystemObject {
    /**
     * Construct a new directory object
     * @param {FileSystemObject} stat Stat data
     * @param {string} request The directory the filesystem is mounted to
     * @param {Error} err Any error associated with fetching the object
     */
    constructor(stat, request, err = undefined) {
        super(stat, request, err);

        /** @type {FileSystemObject} */
        this.contents = [];
    }

    /**
     * Maps a path relative to this object
     * @param {any} expr
     */
    mapPath(expr) {
        return path.posix.join(this.path, FileSystemObject.convertPath(expr));
    }
}

class DirectoryWrapper extends DirectoryObject {
    /**
     * Wraps a directory instance
     * @param {DirectoryObject} instance
     * @param {FileSystemRequest} request
     */
    constructor(instance, request) {
        super(instance, request);

        let target = instance;

        Object.defineProperties(this, {
            readAsync: {
                value: async () => {
                    if (target.contents) {

                    }
                }
            },
            refresh: {
                value: async () => {

                },
                writable: false
            }
        });
    }
}

/** 
 * Abstract class for implementing a file object 
 */
class FileObject extends FileSystemObject {
    /**
     * Construct a new file object
     * @param {FileSystemObject} stat Stat data
     * @param {FileSystemRequest} request The directory the filesystem is mounted to
     * @param {Error} err Any error associated with fetching the object
     */
    constructor(stat, request, err = undefined) {
        super(stat, request, err);
    }

    get extension() {
        let n = this.name.lastIndexOf('.');
        return n > -1 ? this.name.substring(n) : '';
    }

    get baseName() {
        let n = this.path.lastIndexOf('.');
        return n > -1 ? this.path.substring(0, n) : this.path;
    }
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


module.exports = {
    FileSystemObject,
    DirectoryObject,
    FileObject,
    ObjectNotFound,
    DirectoryWrapper
};
