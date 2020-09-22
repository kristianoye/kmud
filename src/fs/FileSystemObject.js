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

        this.acl = null;
        this.content = data.content || '';
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

        return new FileSystemObject({
            absolutePath: request.fullPath,
            atime: dt,
            atimeMs: dt.getTime(),
            birthtime: dt,
            birthtimeMs: dt.getTime(),
            blksize: 4096,
            blocks: 0,
            ctime: dt,
            ctimeMs: dt.getTime(),
            dev: -1,
            error: err || new Error('Unknown error'),
            exists: false,
            gid: -1,
            ino: -1,
            nlink: -1,
            uid: -1,
            mode: -1,
            mtime: dt,
            mtimeMs: dt.getTime(),
            name: request.fileName,
            path: request.fullPath || '',
            size: -1,
            rdev: -1,
            isBlockDevice: false,
            isCharacterDevice: false,
            isDirectory: false,
            isFIFO: false,
            isFile: false,
            isSocket: false,
            isSymbolicLink: false
        }, request);
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
            return await driver.fileManager.statAsync(parentPath)
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
        return path.posix.join(this.path, '..', expr);
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
    }

    /**
     * Maps a path relative to this object
     * @param {any} expr
     */
    mapPath(expr) {
        return path.posix.join(this.path, expr);
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
    ObjectNotFound
};
