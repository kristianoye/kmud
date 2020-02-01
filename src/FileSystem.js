/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides an abstraction for the MUD filesystems.
 */
const
    MUDEventEmitter = require('./MUDEventEmitter'),
    { NotImplementedError } = require('./ErrorTypes'),
    FS_NONE = 0,            // No flags set
    FS_SYNC = 1 << 0,       // The filesystem supports syncronous I/O.
    FS_ASYNC = 1 << 2,      // The filesystem supports asyncronous I/O.
    FS_DIRECTORIES = 1 << 3,// The filesystem supports directories.
    FS_READONLY = 1 << 4,   // The filesystem is read-only.
    FS_WILDCARDS = 1 << 5,  // The filesystem supports use of wildcards.
    FS_DATAONLY = 1 << 6,   // The filesystem only supports structured data files (JSON).
    FS_OBJECTS = 1 << 7,    // The filesystem supports objects loading via the compiler.
    FT_UNKNOWN = 0,         // Symbolic links, Windows Junctions, file sockets, and other currently unsuppported types.
    FT_FILE = 1 << 0,       // The target is a regular file.
    FT_DIRECTORY = 1 << 1;  // The target is a directory.

const
    P_NONE = 0,

    //  chmod flags
    P_EXEC = 1 << 0,
    P_WRITE = 1 << 1,
    P_READ = 1 << 2,

    P_LOADOBJECT = 1 << 3,
    P_CREATEFILE = 1 << 4,
    P_CREATEDIRECTORY = 1 << 5,
    P_DELETEDIRECTORY = 1 << 6,
    P_CHANGEPERMS = 1 << 7,
    P_CHANGEOWNER = 1 << 8,
    P_HIDDEN = 1 << 9,
    P_TAKEOWNERSHIP = 1 << 10,
    P_INHERITS = 1 << 11;

// #region File ACL Objects

class AclEntry {
    /**
     * Construct a file entry
     * @param {AclNode} parent
     * @param {string} name
     */
    constructor(parent, name) {
        this.filename = name;
        this.inherits = true;
        this.permissions = {};
        this.metaData = {};
        this.parent = parent;
    }

    /**
     * Determine effective permissions for this file entry.
     * @param {any} username
     */
    effectivePermissions(username) {
        let perms = this.inherits ? this.parent.effectivePermissions(username) : P_NONE;
        Object.keys(this.permissions).forEach(p => {
            if (p.startsWith('$')) {
                if (driver.inGroup(username, p))
                    result |= this.permissions[p];
            }
            else if (p === username)
                result |= this.permissions[p];
        });
        return perms;
    }
}

class AclNode {
    /**
     * @param {AclTree} owner The owner of the node
     * @param {Object.<string,string>} data
     * @param {string} dir
     */
    constructor(owner, data, dir, content = {}) {
        let parts = dir.split('/').filter(s => s.length);
        let raw = data[dir];

        /** @type {Object.<string,AclNode>} */
        this.children = {};
        this.containsRegex = false;
        this.path = dir;
        this.depth = parts.length;
        /** @type {Object.<string,AclEntry>} */
        this.files = content.files || {};
        this.name = parts.pop() || '/';
        this.inherits = !raw.startsWith('~');
        if (this.name === '$token') {
            this.name = '[^/]+';
        }
        this.isRegex = /[\?\(\)\.\[\]]+/.test(this.name);
        this.isSpecial = raw.startsWith('+');
        this.owner = owner;
        this.parent = this;
        /** @type {Object.<string,number>} */
        this.permissions = {};
        /** @type {AclNode[]} */
        this.regexEntries = [];

        if (this.isRegex) {
            this.regex = new RegExp('(' + this.name + ')');
        }
        if (content.permissions)
            this.permissions = content.permissions;
        else {
            raw = raw.substring(data[dir].startsWith('+') || data[dir].startsWith('~') ? 1 : 0);
            if (raw)
                raw.split(/\s+/).forEach(c => {
                    let entry = c.split(':'),
                        list = entry[0].split(',').filter(s => s),
                        perms = FileACL.parsePerms(entry[1]);
                    list.forEach(id => this.permissions[id] = perms);
                });
        }
    }

    addChild(node) {
        this.children[node.name] = node;
        this.containsRegex |= node.isRegex;
        if (node.isRegex) this.regexEntries.push(node);
        node.parent = this;
    }

    effectivePermissions(username, userOrGroup = false) {
        let result = P_NONE;
        Object.keys(this.permissions).forEach(p => {
            if (p === '%token' && username === userOrGroup)
                result |= this.permissions[p];
            else if (p === '$%token' && userOrGroup && driver.inGroup(username, `${userOrGroup}`))
                result |= this.permissions[p];
            else if (p.startsWith('$')) {
                if (driver.inGroup(username, p))
                    result |= this.permissions[p];
            }
            else if (p === username)
                result |= this.permissions[p];
        });
        return result;
    }

    /**
     * 
     * @param {string} dir
     * @param {Object.<string,string>} data
     * @param {AclNode|false} node
     */
    async insert(dir, data, node = false) {
        node = node || await AclNode.load(this.owner, data, dir);

        if (node.depth == this.depth) this.addChild(node);
        else if (node.depth === this.depth + 1) this.addChild(node);
        else if (node.depth > this.depth) {
            let parts = dir.split('/'),
                child = this.children[parts[this.depth + 1]] || false;
            if (child) child.insert(dir, data, node);
            else throw new Error(`AclTree failure: Could not find parent node for '${dir}'`);
        }
        return node;
    }

    /**
     * Does the regex node match the specified path?
     * @param {string} name
     */
    isMatch(name) {
        if (!this.isRegex)
            return false;
        else {
            let m = this.regex.exec(name);
            return m[1];
        }
    }

    static async load(owner, data, dir) {
        let filename = `${dir}/.acl`;

        return await driver.driverCallAsync('load', async () => {
            try {
                let content = await driver.fileManager.readJsonFileAsync(driver.efuns, filename);
                if (content)
                    return new AclNode(owner, data, dir, content);
            }
            catch (e) {
                console.log(`Acl load error: ${e.message}`);
            }
            return new AclNode(owner, data, dir);
        });
    }

    async save() {
        let filename = `${this.path}/.acl`;
        if (!this.isRegex && !this.isSpecial) {
            await driver.driverCallAsync('save', async () => {
                await driver.fileManager.writeJsonFileAsync(driver.efuns, filename, {
                    permissions: this.permissions,
                    files: this.files
                });
            });
        }
    }
}

class AclTree {
    /**
     * 
     * @param {Object.<string,string>} data
     */
    constructor(data) {
        this.root = new AclNode(this, data, '/');
    }

    /**
     * Determine effective permissions 
     * @param {string} expr The file expression being evaluated
     * @param {string} username The name of the active user
     */
    async effectivePermissions(expr, username) {
        let parts = expr.split('/').filter(s => s),
            node = this.root,
            perms = node.effectivePermissions(username);

        for (let i = 0, max = parts.length; i < max; i++) {
            let foo = parts[i];

            if (node.children[foo]) {
                node = node.children[foo];
                if (node.inherits)
                    perms |= node.effectivePermissions(username);
                else
                    perms = node.effectivePermissions(username);
            }
            else if (node.containsRegex) {
                node.regexEntries.forEach(r => {
                    let userOrGroup = r.isMatch(foo);
                    if (userOrGroup !== false) {
                        node = r;
                        if (r.inherits)
                            perms |= node.effectivePermissions(username, userOrGroup);
                        else
                            perms = node.effectivePermissions(username, userOrGroup);
                    }
                });
            }
            else if (foo in node.files) {
                if (foo !== '.acl')
                    return node.files[foo].effectivePermissions(username);
            }
        }
        return perms;
    }
}

class FileACL {
    constructor() {
    }

    /**
     * Get the parent ACL (if any) 
     */
    async getParent() {
    }

    /**
     * Does this ACL inherit from its parent?
     */
    get inherits() {
    }

    get owner() {
    }

    /**
     * Parse a raw ACL tree
     * @param {Object.<string,string>} data 
     */
    static async parseAclTree(data) {
        let tree = new AclTree(data), keys = Object.keys(data).filter(s => s !== '/');
        for (let i = 0; i < keys.length; i++) {
            let node = await tree.root.insert(keys[i], data);
            await node.save();
        }
        return tree;
    }

    /**
     * Converts a permission string into a bitflag collection
     * @param {string} expr The human-readable permission string
     * @returns {number} The bitflag array
     */
    static parsePerms(expr) {
        let result = P_NONE;
        if (!expr)
            return P_NONE;
        if (expr === 'FULL' || expr === 'ALL') expr = "rwxcdlCDPOT";
        else if (expr === 'READ') expr = 'rlL';
        for (let i = 0; i < expr.length; i++) {
            switch (expr[i]) {
                //  chmod compat
                case 'x': result |= P_EXEC; break; // Execute/change directory
                case 'w': result |= P_WRITE; break; // Write file
                case 'r': result |= P_READ; break; // Read file

                //  additional permissions
                case 'l': result |= P_LOADOBJECT; break; // Load object
                case 'c': result |= P_CREATEFILE; break; // Create file
                case 'C': result |= P_CREATEDIRECTORY; break; // Create dir
                case 'D': result |= P_DELETEDIRECTORY; break; // Delete dir
                case 'P': result |= P_CHANGEPERMS; break; // Change perms
                case 'O': result |= P_CHANGEOWNER; break; // Assign owner
                case 'T': result |= P_TAKEOWNERSHIP; break; // Take ownership
                case 'S': case '+': result |= 1 << 12; break; // Special Permission / Dynamic Lookup in Master
            }
        }
        return result;
    }

    /**
     * Convert a permission set into a human readable string
     * @param {number} flags
     */
    static permsToString(flags) {
        let isSet = (x) => (flags & x) > 0;
        let result = '';

        //  chmod compat
        result += isSet(P_READ) ? 'r' : '-';
        result += isSet(P_WRITE) ? 'w' : '-';
        result += isSet(P_EXEC) ? 'x' : '-';


        result += isSet(P_LOADOBJECT) ? 'l' : '-';
        result += isSet(P_CREATEFILE) ? 'c' : '-';
        result += isSet(P_CREATEDIRECTORY) ? 'C' : '-';
        result += isSet(P_DELETEDIRECTORY) ? 'D' : '-';
        result += isSet(P_CHANGEPERMS) ? 'P' : '-';
        result += isSet(P_CHANGEOWNER) ? 'O' : '-';
        result += isSet(P_TAKEOWNERSHIP) ? 'T' : '-';
        if (isSet(11)) result += 'S';
        return result;
    }


    validCreate(filename) {
    }

    validCreateDirectory(filename) {
    }

    validDelete(filename) {
    }

    validLoadObject(filename) {
    }

    validRead(filename) {
    }

    validRemoveDirectory(filename) {
    }

    validWrite(filename) {
    }
}

// #endregion

// #region File System Objects

class FileSystemStat {
    /**
     * Construct a new stat
     * @param {FileSystemStat} data Config data
     * @param {object} options Options from the config
     * @param {string} mountPoint The directory the filesystem is mounted to
     */
    constructor(data, options, mountPoint) {
        Object.assign(this, data);
        this.mountPoint = mountPoint;
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
        let result = {
            exists: this.exists,
            parent: this.parent ? this.parent.clone() : null,
            perms: {},
            type: this.type
        };

        Object.keys(this.perms).forEach(k => {
            result.perms[k] = this.perms[k];
        });

        return result;
    }

    /**
     * 
     * @param {FileSystemStat} data
     * @returns {FileSystemStat}
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

        /** @type {FileSystemStat} */
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
}

class DirectoryObject extends FileSystemStat {
    constructor() {
        super();
    }
}

/**
 * Represents a normal text file
 */
class FileObject extends FileSystemStat {
    get isFile() { return true; }

    /** @type {'unknown'|'directory'|'file'|'objectData'} */
    get objectType() { return 'file'; }
}

/**
 * Represents a file containing object data (usually JSON) 
 */
class ObjectDataFile extends FileSystemStat {
    get isObjectFile() { return true; }

    /** @type {'unknown'|'directory'|'file'|'objectData'} */
    get objectType() { return 'objectData'; }
}

/**
 * @param {FileSystemStat} result The spec to create a stat from.
 * @returns {FileSystemStat} An actual stat object.
 */
FileSystemStat.create = function (result) {
    return new FileSystemStat(result);
};

// #endregion

/**
 * @class
 * Provides a filesystem abstraction to allow implementation of
 * multiple filesystem types (disk-based, SQL-based, ... whatever).
 */
class FileSystem extends MUDEventEmitter {
    /**
     * 
     * @param {FileManager} fileManager
     * @param {{ mountPoint: string, encoding: FileEncoding, flags: number, type: string, asyncReaderLimit: number, root: string }} opts Options passed from the configuration
     */
    constructor(fileManager, opts) {
        super();

        /** @type {GameServer} */
        this.driver = fileManager.driver;

        /** @type {string} */
        this.encoding = opts.encoding || 'utf8';

        /** @type {number} */
        this.flags = opts.flags || FS_NONE;

        /** @type {FileManager} */
        this.manager = fileManager;

        /** @type {string} */
        this.mp = this.mountPoint = opts.mountPoint || '';

        /** @type {FileSecurity} */
        this.securityManager = null;

        /** @type {string} */
        this.type = opts.type || 'unknown';
    }

    /**
     * Sets the security manager.
     * @param {FileSecurity} manager The security manager.
     */
    addSecurityManager(manager) {
        this.securityManager = manager;
    }

    assert(flags, error) {
        if ((this.flags & flags) !== flags)
            return false;
        return true;
    }

    assertAsync() {
        if (!this.isAsync)
            throw new Error(`Filesystem type ${this.type} does not support asyncrononous I/O.`);
        return true;
    }

    assertDirectories() {
        if (!this.hasDirectories)
            throw new Error(`Filesystem type ${this.type} does not support directories.`);
        return true;
    }

    assertSync() {
        if (!this.isSync)
            throw new Error(`Filesystem type ${this.type} does not support syncrononous I/O.`);
        return true;
    }

    assertWritable() {
        if (this.isReadOnly())
            throw new Error(`Filesystem ${this.mp} [type ${this.type}] is read-only.`);
        return true;
    }

    /**
     * Clone an object
     * @param {FileSystemRequest} req The clone request
     * @param {any} args Constructor args
     * @param {function(MUDObject,Error):void} callback Callback for async cloneObject() request
     */
    cloneObject(req, args, callback) {
        return typeof callback !== 'undefined' ?
            this.cloneObjectAsync(req, args, callback) :
            this.cloneObjectSync(req, args);
    }

    /**
     * Create a directory in the filesystem.
     * @param {FileSystemRequest} req The directory expression to create.
     * @param {MkDirOptions} opts Optional flags for createDirectory()
     * @param {function(boolean, Error):void} callback A callback for async mode
     */
    createDirectoryAsync(req, opts, callback) {
        throw new NotImplementedError('createDirectoryAsync');
    }

    /**
     * Create a directory in the filesystem.
     * @param {FileSystemRequest} req The directory expression to create.
     * @param {MkDirOptions} opts Optional flags for createDirectory()
     */
    createDirectorySync(req, opts) {
        throw new NotImplementedError('createDirectorySync');
    }

    /**
     * @returns {FileSystemStat} The final stat object.
     */
    createPermsResult(req, perms, parent) {
        return new FileSystemStat({
            fileName: req,
            perms: perms || {},
            parent: parent || null
        });
    }

    /**
     * Removes a directory from the filesystem.
     * @param {string} req The path of the directory to remove.
     * @param {any} flags TBD
     */
    async deleteDirectoryAsync(req, flags) {
        throw new NotImplementedError('deleteDirectoryAsync');
    }

    /**
     * Removes a directory from the filesystem.
     * @param {string} req The path of the directory to remove.
     * @param {number} flags TBD
     */
    deleteDirectorySync(req, flags) {
        throw new NotImplementedError('createDirectorySync');
    }

    /**
     * Removes a directory from the filesystem.
     * @param {string} req The path of the directory to remove.
     * @param {number} flags TBD
     */
    deleteDirectorySync(req, flags) {
        throw new NotImplementedError('deleteDirectorySync');
    }

    deleteFile(req, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.deleteFileAsync(req, callback) :
            this.assertSync() && this.deleteFileSync(req);
    }

    deleteFileAsync(req, callback) {
        throw new NotImplementedError('deleteFileAsync');
    }

    deleteFileSync(req) {
        throw new NotImplementedError('deleteFileSync');
    }

    async getDirectory(relativePath) {
        throw new NotImplementedError('deleteFileSync');
    }

    /**
     * Converts the expression into the external filesystem absolute path.
     * @param {FileSystemRequest} req The path to translate.
     * @returns {string} The "real" path.
     */
    getRealPath(req) {
        throw new NotImplementedError('deleteFileSync');
    }

    /**
     * Translate an absolute path back into a virtual path.
     * @param {FileSystemRequest} req The absolute path to translate.
     * @returns {string|false} The virtual path if the expression exists in this filesystem or false if not.
     */
    getVirtualPath(req) { return false; }

    /**
     * @returns {boolean} Returns true if the filesystem supports directory structures.
     */
    get hasDirectories() {
        return (this.flags & FS_DIRECTORIES) > 0;
    }

    /**
     * @returns {boolean} Returns true if the filesystem supports asyncronous I/O
     */
    get isAsync() { return (this.flags & FS_ASYNC) > 0; }

    /**
     * Checks to see if the expression is a directory.
     * @param {FileSystemRequest} req
     * @param {function(boolean, Error):void} callback
     */
    isDirectory(req, callback) {
        this.assertDirectories();
        return typeof callback === 'function' ?
            this.assertAsync() && this.isDirectoryAsync(req, callback) :
            this.assertSync() && this.isDirectorySync(req);
    }

    /**
     * @param {FileSystemRequest} req
     * @returns {Promise<boolean>}
     */
    isDirectoryAsync(req) {
        throw new NotImplementedError('isDirectoryAsync');
    }

    /**
     * @param {FileSystemRequest} req
     */
    isDirectorySync(req) {
        throw new NotImplementedError('isDirectorySync');
    }

    /**
     * Checks to see if the expression is a directory.
     * @param {FileSystemRequest} req
     * @param {function(boolean, Error):void} callback
     */
    isFile(req, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.isFileAsync(req, callback) :
            this.assertSync() && this.isFileSync(req);
    }

    /**
     * @param {FileSystemRequest} req
     * @param {function(boolean,Error):void} callback
     */
    isFileAsync(req, callback) {
        throw new NotImplementedError('isFileAsync');
    }

    /**
     * @param {FileSystemRequest} req
     */
    isFileSync(req) {
        throw new NotImplementedError('isFileSync');
    }

    /**
     * @returns {boolean} Returns true if the filesystem is read-only.
     */
    get isReadOnly() { return (this.flags & FS_READONLY) > 0; }

    /**
     * @returns {boolean} Returns true if the filesystem supports syncronous I/O
     */
    get isSync() { return (this.flags & FS_SYNC) > 0; }

    /**
     * Loads an object from storage.
     * @param {FileSystemRequest} req The path to load the object from.
     * @param {any} args Optional constructor args.
     * @param {function(MUDModule,Error):void} callback Callback that fires if load object was async.
     */
    loadObjectAsync(req, args, callback) {
        throw new NotImplementedError('loadObjectAsync');
    }

    /**
     * Loads an object from storage.
     * @param {FileSystemRequest} req The path to load the object from.
     * @param {PathExpr} expr The path split into parts.
     * @param {any} args Optional constructor args.
     * @param {function(MUDObject):any} callback An optional callback
     */
    loadObjectSync(req, expr, args, callback) {
        throw new NotImplementedError('loadObjectSync');
    }

    /**
     * Reads a directory listing from the disk.
     * @param {FileSystemRequest} req The directory part of the request.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectory(req, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.readDirectoryAsync(req, callback) :
            this.assertSync() && this.readDirectorySync(req);
    }

    /**
     * Reads a directory listing from the disk.
     * @param {FileSystemRequest} req The directory part of the request.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectoryAsync(req, callback) {
        throw new NotImplementedError('readDirectoryAsync');
    }

    /**
     * Reads a directory listing from the disk.
     * @param {FileSystemRequest} req The directory part of the request.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectorySync(req) {
        throw new NotImplementedError('readDirectorySync');
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} req The file path expression to read from.
     * @param {function(string,Error):void} callback The callback that fires when the read is complete.
     */
    readFile(req, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.readFileAsync(req, callback) :
            this.assertSync() && this.readFileSync(req);
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} req The file path expression to read from.
     * @param {function(string,Error):void} callback The callback that fires when the read is complete.
     */
    readFileAsync(req, callback) {
        throw new NotImplementedError('readFileAsync');
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} req The file path expression to read from.
     */
    readFileSync(req) {
        throw new NotImplementedError('readFileSync');
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} req The file path expression to read from.
     * @param {function(string,Error):void} callback The callback that fires when the read is complete.
     */
    async readJsonFileAsync(expr, callback) {
        throw new NotImplementedError('readJsonFileAsync');
    }

    /**
     * Read a file from the filesystem.
     * @param {FileSystemRequest} req The file path expression to read from.
     * @param {function(string,Error):void} callback The callback that fires when the read is complete.
     */
    readJsonFileSync(expr) {
        throw new NotImplementedError('readJsonFileSync');
    }

    /**
     * Stat a file within the filesystem.
     * @param {FileSystemRequest} req The file expression to evaluate.s
     * @param {function(FileSystemStat,Error):void} callback An optional callback for async mode.
     * @returns {FileSystemStat} The filesystem stat info.
     */
    stat(req, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.statAsync(req, callback) :
            this.assertSync() && this.statSync(req);
    }

    /**
     * Stat a file asyncronously.
     * @param {string} relativePath The file expression to stat.
     */
    async statAsync(relativePath) {
        throw new NotImplementedError('statAsync');
    }

    /**
     * Stat a file syncronously.
     * @param {FileSystemRequest} req The file expression to stat.
     */
    statSync(req) {
        throw new NotImplementedError('statSync');
    }

    /**
     * Write content to a file.
     * @param {FileSystemRequest} req
     * @param {string|Buffer} content
     * @param {function(boolean, Error):void} callback
     */
    writeFile(req, content, callback) {
        return typeof callback === 'function' ?
            this.assertAsync() && this.writeFileAsync(req, content, callback) :
            this.assertSync() && this.writeFileSync(req, content);
    }

    /**
     * Write content to a file.
     * @param {FileSystemRequest} req
     * @param {string|Buffer} content
     * @param {string|number} [flags] The optional flags to use
     * @param {string} [encoding] The optional encoding to use
     */
    writeFileAsync(req, content, flags, encoding) {
        throw new NotImplementedError('writeFileAsync');
    }

    /**
     * Write content to a file.
     * @param {FileSystemRequest} req
     * @param {string|Buffer} content
     */
    writeFileSync(req, content) {
        throw new NotImplementedError('writeFileSync');
    }
}

FileSystem.createObject = function () {

};

/**
 * Filesystem supports asyncronous operations.
 */
FileSystem.FS_ASYNC = FS_ASYNC;

/**
 * Filesystem ONLY supports structured data.
 */
FileSystem.FS_DATAONLY = FS_DATAONLY;

/**
 * Filesystem supports directories.
 */
FileSystem.FS_DIRECTORIES = FS_DIRECTORIES;

/**
 * Filesystem supports the loading and compiling of MUD objects.
 */
FileSystem.FS_OBJECTS = FS_OBJECTS;

/**
 * Filesystem is read-only.
 */
FileSystem.FS_READONLY = FS_READONLY;

/**
 * Filesystem supports syncronous operations.
 */
FileSystem.FS_SYNC = FS_SYNC;

/**
 * Filesystem supports the use of wildcards.
 */
FileSystem.FS_WILDCARDS = FS_WILDCARDS;

module.exports = {
    FileSystem,
    FileSystemStat,
    DirectoryObject,
    FileObject,
    ObjectDataFile,
    FileACL
};

