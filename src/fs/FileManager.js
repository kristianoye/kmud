
const
    MUDEventEmitter = require('../MUDEventEmitter'),
    { FileSystemObject, ObjectNotFound } = require('./FileSystemObject'),
    FileSystemRequest = require('./FileSystemRequest'),
    Cache = require('../Cache'),
    crypto = require('crypto'),
    path = require('path');

/**
 * The file manager object receives external requests, creates internal requests,
 * and dispatches those requests to the file and security systems.  It then sends
 * the results back to the user (usually an efuns proxy instance).
 */
class FileManager extends MUDEventEmitter {
    /**
     * Construct the file manager
     */
    constructor(options) {
        super();

        /** 
         * Contains a cache of previously accessed directories */
        this.directoryCache = new Cache({ capacity: options.directoryCacheSize || 1000, key: 'path' });

        /** @type {Object.<string,FileSystem>} */
        this.fileSystems = {};

        /** @type {Object.<string,FileSystem>} */
        this.fileSystemsById = {};

        /** @type {string} */
        this.mudlibRoot = driver.config.mudlib.baseDirectory;

        /** @type {string} */
        this.mudlibAbsolute = path.resolve(__dirname, this.mudlibRoot);
    }

    /**
     * Not needed by default file manager.
     */
    assertValid() {
        return this;
    }

    /**
     * Clone an object into existance.
     * @param {string} expr The module to clone
     * @param {any} args Constructor args for clone
     * @returns {MUDWrapper} The wrapped instance.
     */
    async cloneObjectAsync(expr, args = []) {
        let request = this.createFileRequest('cloneObject', expr);
        if (!request.valid('LoadObject'))
            return request.deny();
        else
            return await request.fileSystem.cloneObjectAsync(request, args);
    }

    /**
     * Create a directory asynchronously
     * @param {string} expr The directory to create
     * @param {number} flags Additional flags to control the operation
     */
    async createDirectoryAsync(expr, flags = 0) {
        let request = this.createFileRequest('CreateDirectory', expr, flags);
        return request.valid('validReadDirectory') && await request.fileSystem.createDirectoryAsync(request);
    }

    /**
     * Create a request that describes the current operation.
     * 
     * @param {string} op The name of the file operation
     * @param {string} expr THe filename expression being operated on
     * @param {string|number} flags Any numeric flags associated with the operation
     * @returns {FileSystemRequest} The request to be fulfilled.
     */
    createFileRequest(op, expr, flags = 0) {
        let { fileSystem, relativePath } = this.getFilesystem(expr);

        let result = new FileSystemRequest({
            fs: fileSystem,
            flags: flags,
            op: op || '',
            expr,
            relativePath
        });
        return result;
    }

    /**
     * Create the specified filesystem.
     * @param {MudlibFileMount} fsconfig The filesystem to mount.
     */
    async createFileSystem(fsconfig) {
        try {
            let fileSystemModulePath = path.join(__dirname, '..', fsconfig.type),
                fileSystemType = require(fileSystemModulePath),
                securityManagerType = require(path.join(__dirname, '..', fsconfig.securityManager)),
                systemId = crypto.createHash('md5').update(fsconfig.mountPoint).digest('hex'),
                fileSystem = new fileSystemType(this, Object.assign({ systemId: systemId }, fsconfig.options), fsconfig.mountPoint),
                securityManager = new securityManagerType(this, fileSystem, fsconfig.securityManagerOptions);

            this.fileSystems[fsconfig.mountPoint] = fileSystem;
            this.fileSystemsById[systemId] = fileSystem;
            this.securityManager = securityManager;

            return fileSystem;
        }
        catch (err) {
            console.log(`Error in FileManager.createFileSystem(): ${err.message}`);
            throw err;
        }
    }

    /**
     * Remove a directory from the filesystem.
     * @param {string} expr The directory to remove.
     * @param {number} flags Any additional options.
     */
    deleteDirectoryAsync(expr, flags) {
        let request = this.createFileRequest('deleteDirectoryAsync', expr, flags);

        return new Promise(async (resolve, reject) => {
            try {
                let directory = await this.getDirectoryAsync(request.path);

                if (!directory.exists)
                    reject(`Directory ${request.path} does not exist.`);

                let result = await directory.deleteAsync(request.flags);
                resolve(result);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Delete/unlink a file from the filesystem.
     * @param {string} expr The path expression to remove.
     * @param {number} flags Flags to control the operation.
     */
    deleteFileAsync(expr, flags = 0) {
        return new Promise(async (resolve, reject) => {
            try {
                let file = await this.getFileAsync(expr, flags);
                resolve(await file.deleteAsync(flags));
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Iterate over the filesystems and perform an action for each.
     * @param {function(FileSystem,string):any[]} callback
     * @returns {any[]} The result of all the actions taken, one element for each filesystem.
     */
    eachFileSystem(callback) {
        return Object.keys(this.fileSystems)
            .map(id => callback(this.fileSystems[id], id));
    }

    /**
     * Get a directory object
     * @param {string} expr The directory expression to fetch
     * @param {number} flags Flags to control the operation
     * @returns {Promise<DirectoryObject>} Returns a directory object.
     */
    async getDirectoryAsync(expr, flags = 0) {
        let req = this.createFileRequest('getDirectoryAsync', expr, flags),
            result = this.directoryCache.get(req.fullPath);
        if (!result) {
            result = await req.fileSystem.getDirectoryAsync(req);
            return this.directoryCache.store(result);
        }
        return result;
    }

    /**
     * Get a file object
     * @param {string} expr The file path to get
     * @param {number} flags Flags associated with the request
     * @returns {Promise<FileObject>}
     */
    getFileAsync(expr, flags = 0) {
        return new Promise(async (resolve, reject) => {
            try {
                let request = this.createFileRequest('getFileAsync', expr, flags);
                let directory = await this.getDirectoryAsync(request.directory);
                let result = await directory.getFileAsync(request.name);
                return resolve(result);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Locate the filesystem for the specified absolute path
     * @param {string} expr The directory expression
     * @returns {{fileSystem:FileSystem, relativePath:string}} Returns a filesystem or a filesystem and relative path if withRelativePath is true
     */
    getFilesystem(expr) {
        let parts = expr.split('/'),
            fileSystem = this.fileSystems['/'] || false;
        let /** @type {string[]} */ relParts = [],
            relativePath = '/';

        while (parts.length) {
            let dir = parts.length === 1 && !parts[0] ? '/' : parts.join('/');
            if (dir in this.fileSystems) {
                relativePath = relParts.join('/');
                fileSystem = this.fileSystems[dir];
                break;
            }
            relParts.unshift(parts.pop());
        }

        if (!fileSystem)
            throw new Error('Fatal: Could not locate filesystem');
        return { fileSystem, relativePath };
    }

    /**
     * Get a filesystem based on its system id
     * @param {string} id The ID to fetch
     */
    getFileSystemById(id) {
        return id in this.fileSystemsById === true && this.fileSystemsById[id];
    }

    /**
     * This method MUST ALWAYS return a filesystem object.  If the object does
     * not exist or an error occurs this method should return a ObjectNotFound
     * FileSystem object.
     * @param {string} expr The path expression to fetch
     * @param {number} flags Filesystem flags to control the operation
     * @returns {Promise<FileSystemObject>}
     */
    getObjectAsync(expr, flags = 0) {
        let request = this.createFileRequest('getObjectAsync', expr),
            result;
        try {
            result = request.fileSystem.getObjectAsync(request);
        }
        catch (err) {
            result = new ObjectNotFound(
                FileSystemObject.createDummyStats(request),
                request,
                err);
        }
        return result;
    }

    /**
     * SHOULD NEVER BE EXPOSED TO THE MUDLIB
     * Fetches a system file to be used within the driver.
     * @param {string} expr The file to load
     */
    async getSystemFileAsync(expr) {
        let request = this.createFileRequest('getSystemFileAsync', expr);
        return await request.fileSystem.getSystemFileAsync(request);
    }

    /**
     * Locate file objects based on the given patterns.
     * The expressions should always start from the root and contain:
     *   - Double asterisk wildcard for recursive blooms
     *   - Single asterisk wildcards
     *   - Question marks for single characters
     * @param {Glob} options
     * @param {...string} expr One or more expressions to evaluate
     * @returns {FileSystemObject[]} Returns a collection of filesystem objects
     */
    async glob(options = 0, ...expr) {
        /** @type {string[]} */
        let args = [].slice.apply(arguments);
        /** @type {FileSystemObject[]} */
        let results = [];

        if (typeof args[0] === 'number')
            options = args.shift();

        //  For each expression provided...
        for (let i = 0, mi = args.length; i < mi; i++) {
            //  Split into directory parts...
            let parts = args[i].split('/'), opts = options;

            // for each part:
            for (let j = 0, mj = parts.length; j < mj; j++) {
                let pj = parts[j],
                    dir = j > 0 ? parts.slice(0, j - 1).join('/') : '/',
                    { fileSystem, relativePath } = this.getFilesystem(dir);

                if (pj === '**') {
                    //  At this point, get all files at or below this point of the tree
                    //  and convert the remaining file tokens into a regex
                    opts |= Glob.Recursive;

                    /** An additional list of directories to fetch content for
                     * @type {FileSystemObject[]} */
                    let dirStack = [];

                    let subset = await fileSystem.glob(relativePath, '*', opts);
                }
                else if (pj.indexOf('**') > -1)
                    throw new Error('Double asterisk must be a standalone token in expression');

                await fileSystem.glob(relativePath, pj, opts);
            }
        }
        return results;
    }

    /**
     * Helper method to check if an expression is a directory.
     * @param {string} expr The path expression to evaluate.
     * @returns {Promise<boolean>} Returns true if the expression is a directory.
     */
    async isDirectoryAsync(expr) {
        let request = this.createFileRequest('isDirectory', expr, true, 0);
        return request.valid('validReadDirectory') && await request.fileSystem.isDirectoryAsync(request);
    }

    /**
     * Check to see if the given expression is a file,
     * @param {string} expr The path expression to evaluate.
     * @param {number} flags Additional flags for the operation
     * @returns {boolean} True if the expression is a file.
     */
    async isFileAsync(expr, flags = 0) {
        let request = this.createFileRequest('isFileAsync', expr);
        return request.valid('validRead') && await request.fileSystem.isFileAsync(request);
    }

    /**
     * Load an object from disk.
     * @param {string} expr Information about what is being requested.
     * @param {any} args Data to pass to the constructor.
     * @param {number} flags Flags to control the operation
     * @returns {MUDObject} The loaded object... hopefully
     */
    async loadObjectAsync(expr, args, flags = 0) {
        let request = this.createFileRequest('loadObjectAsync', expr, flags);
        return request.valid('validLoadObject') && await request.fileSystem.loadObjectAsync(request, args || []);
    }

    async readDirectoryAsync(expr, flags = 0) {
        let request = this.createFileRequest('readDirectoryAsync', expr, flags);
        return request.valid('validReadDirectory') && await request.fileSystem.readDirectoryAsync(request);
    }

    /**
     * Reads a file from the filesystem.
     * @param {string} expr The file to try and read.
     * @returns {string} The content from the file.
     */
    async readFileAsync(expr) {
        let request = this.createFileRequest('readFileAsync', expr);
        return request.valid('validReadFile') && await request.fileSystem.readFileAsync(request);
    }

    /**
     * Read structured data from the specified location.
     * @param {FileSystemRequest} expr The JSON file being read.
     * @param {function=} callback An optional callback for async mode.
     */
    async readJsonAsync(expr) {
        return new Promise(async (resolve, reject) => {
            try {
                let request = this.createFileRequest('readJsonFile', expr);
                let directory = await this.getDirectoryAsync(request.directory);
                if (!directory.exists)
                    reject(new Error(`Directory ${request.directory} does not exist.`));
                let file = await directory.getFileAsync(request.name);
                if (!file.exists)
                    reject(new Error(`File ${request.path} does not exist.`));
                let results = await file.readJsonAsync();
                resolve(results);
            }
            catch (err) {
                reject(err);
            }
        });
        return request.valid('validReadFile') && await request.fileSystem.readJsonAsync(request);
    }

    async readYamlAsync(expr) {
        let request = this.createFileRequest('readYamlFile', expr);
        return request.valid('validReadFile') && await request.fileSystem.readYamlAsync(request);
    }

    /**
     * Stat a file
     * @param {any} expr
     * @param {any} flags
     */
    async statAsync(expr, flags = 0) {
        let request = this.createFileRequest('stat', expr, flags),
            result;
        if (!request.valid('validStatFile'))
            return request.deny();
        else {
            try {
                result = await request.fileSystem.statAsync(request);
            }
            catch (err) {
                result = FileSystemObject.createDummyStats(request, err);
            }
            result = Object.freeze(result);
            return result;
        }
    }

    /**
     * Converts a real path into a virtual MUD path.
     * @param {string} expr The absolute file path to translate.
     * @returns {string} The virtual MUD path or false if not in the virtual filesystem.
     */
    toMudPath(expr) {
        let fsn = Object.keys(this.fileSystems);
        for (let i = 0; i < fsn.length; i++) {
            let fso = this.fileSystems[fsn[i]],
                result = fso.getVirtualPath(expr);
            if (result) return fsn[i] + result;
        }
        return false;
    }

    /**
     * Translates a virtual path into an absolute path (if filesystem supported)
     * @param {string} expr The virtual directory to translate.
     * @returns {string} The absolute path.
     */
    toRealPath(expr) {
        let req = this.createFileRequest('toRealPath', expr);
        return req.fileSystem.getRealPath(req.relativePath);
    }

    /**
     * Write to a file asyncronously.
     * @param {string} expr The file to write to.
     * @param {string|Buffer} content The content to write to file.
     * @param {string} flags Flags controlling the operation.
     * @param {string} encoding The optional encoding to use
     * @returns {Promise<boolean>} The promise for the operation.
     */
    async writeFileAsync(expr, content, flags, encoding) {
        let request = this.createFileRequest('writeFileAsync', expr, flags || 'w');
        return request.valid('validWriteFile') && request.fileSystem.writeFileAsync(request, content);
    }

    /**
     * 
     * @param {string} expr The location to write data to
     * @param {string} content The block of JSON data to write
     * @returns {Promise<boolean>} An indication of success or failure
     */
    async writeJsonAsync(expr, content, flags = 0) {
        let request = this.createFileRequest('writeJsonAsync', expr, false, 0, null);
        return request.valid('validWriteFile') && await request.fileSystem.writeJsonAsync(request, content);
    }
}

module.exports = FileManager;
