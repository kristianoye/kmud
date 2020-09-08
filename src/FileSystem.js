/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides an abstraction for the MUD filesystems.
 */
const
    MUDEventEmitter = require('./MUDEventEmitter'),
    { MudlibFileMount } = require('./config/MudlibFileSystem'),
    { NotImplementedError } = require('./ErrorTypes'),
    { Glob } = require('./FileSystem'),
    crypto = require('crypto'),
    async = require('async'),
    path = require('path');

const
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

/**
 * Represents the permissions for a file or directory.  This contains both:
 *   - The list of user permissions that can access/modify the object
 *   - The list of permission groups this file/directory have been assigned
 */
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
            // $ = user groups, ~ = wizard-created group, ^ = domain-specific groups
            if (p.startsWith('$') || p.startsWith('~') || p.startsWith('^')) {
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
                let content = await driver.fileManager.readJsonAsync(filename);
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
                await driver.fileManager.writeJsonAsync(driver.efuns, filename, {
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
        let tree = new AclTree(data),
            keys = Object.keys(data).filter(s => s !== '/');

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

/**
 * A file system object represents a single object on a filesystem.  This 
 * may be a directory or a file or some other construct (possible a FIFO,
 * symlink, etc).  A filesystem object MUST contain the following:
 *   - A name (no slashes)
 *   - An absolute MUD path from the root
 *   - An AclNode object containing permission information
 *   - A filesystem ID to denote which filesystem on which the object exists
 *   - A parent file object
 *   
 */
class FileSystemStat {
    /**
     * Construct a new stat
     * @param {FileSystemStat} data Config data
     * @param {string} mountPoint The directory the filesystem is mounted to
     * @param {Error} err Any error associated with fetching the object
     */
    constructor(data, mountPoint, err) {
        Object.assign(this, data);

        /** @type {AclEntry} */
        this.acl = null;
        this.content = data.content || '';
        this.error = err;
        this.fullPath = '';
        this.mountPoint = mountPoint;
        this.name = '';
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

    /**
     * Refresh cached data and return a new copy of the object
     */
    refresh() {
        return new FileSystemStat(this);
    }
}

class DirectoryObject extends FileSystemStat {
    /**
     * Construct a new directory object
     * @param {FileSystemStat} stat Stat data
     * @param {string} mountPoint The directory the filesystem is mounted to
     * @param {Error} err Any error associated with fetching the object
     */
    constructor(stat, mountPoint, err = undefined) {
        super(stat, mountPoint, err);
    }

    read() {

    }
}

/**
 * Represents a normal text file
 */
class FileObject extends FileSystemStat {
    /**
     * Construct a new file object
     * @param {FileSystemStat} stat Stat data
     * @param {string} mountPoint The directory the filesystem is mounted to
     * @param {Error} err Any error associated with fetching the object
     */
    constructor(stat, mountPoint, err = undefined) {
        super(stat, mountPoint, err);
    }
}

/**
 * Represents a file containing object data (usually JSON) 
 */
class ObjectDataFile extends FileSystemStat {
    get isObjectFile() { return true; }

    /** @type {'unknown'|'directory'|'file'|'objectData'} */
    get objectType() { return 'objectData'; }
}

// #endregion

/**
 * Provides a filesystem abstraction to allow implementation of
 * multiple filesystem types (disk-based, SQL-based, ... whatever).
 */
class FileSystem extends MUDEventEmitter {
    /**
     * 
     * @param {FileManager} fileManager
     * @param {FileSystemOptions} opts Options passed from the configuration
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
        this.mp = this.mountPoint = opts.mountPoint;

        /** @type {FileSecurity} */
        this.securityManager = null;

        this.systemId = opts.systemId;

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
     * Create a directory in the filesystem.
     * @param {FileSystemRequest} req The directory expression to create.
     * @param {MkDirOptions} opts Optional flags for createDirectory()
     * @param {function(boolean, Error):void} callback A callback for async mode
     */
    createDirectoryAsync(req, opts, callback) {
        throw new NotImplementedError('createDirectoryAsync');
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

    async deleteFileAsync(req, callback) {
        throw new NotImplementedError('deleteFileAsync');
    }

    /**
     * Get a directory object
     * @param {string} expr The directory expression to fetch
     * @param {any} flags Flags to control the operation
     */
    getDirectoryAsync(expr, flags = 0) {
        throw new NotImplementedError('getDirectoryAsync');
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
    getVirtualPath(req) {
        return false;
    }

    /**
     * Glob a directory
     * @param {string} dir The directory to search
     * @param {string} expr An expression to glob for
     * @param {Glob} options Options to control the operation
     */
    async glob(dir, expr, options = 0) {
        throw new NotImplementedError('glob');
    }

    /**
     * @returns {boolean} Returns true if the filesystem supports directory structures.
     */
    get hasDirectories() {
        return (this.flags & FS_DIRECTORIES) > 0;
    }

    /**
     * @returns {boolean} Returns true if the filesystem supports asyncronous I/O
     */
    get isAsync() {
        return (this.flags & FS_ASYNC) > 0;
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
     * @param {function(boolean,Error):void} callback
     */
    isFileAsync(req, callback) {
        throw new NotImplementedError('isFileAsync');
    }

    /**
     * @returns {boolean} Returns true if the filesystem is read-only.
     */
    get isReadOnly() {
        return (this.flags & FS_READONLY) > 0;
    }

    /**
     * @returns {boolean} Returns true if the filesystem supports syncronous I/O
     */
    get isSync() {
        return (this.flags & FS_SYNC) > 0;
    }

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
     * Reads a directory listing from the disk.
     * @param {FileSystemRequest} req The directory part of the request.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectoryAsync(req, callback) {
        throw new NotImplementedError('readDirectoryAsync');
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
     * @param {function(string,Error):void} callback The callback that fires when the read is complete.
     */
    async readJsonAsync(expr, callback) {
        throw new NotImplementedError('readJsonAsync');
    }

    /**
     * Stat a file asyncronously.
     * @param {string} relativePath The file expression to stat.
     * @returns {Promise<FileSystemStat>} Returns a stat object.
     */
    async statAsync(relativePath) {
        throw new NotImplementedError('statAsync');
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
}

// #region Constants

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

// #endregion

// #region FileManager 

/**
 * @typedef {Object} FileSystemRequestData 
 * @property {FileSystem} fs The filesystem where the target exists
 * @property {string|number} flags Flags to control the operation
 * @property {string} op The operation being performed
 * @property {string} expr The file expression
 * @property {string} relPath The relative path to the root of the filesystem
 * @property {boolean} isAsync Is the request asyncronous?
 **/

/**
 * Contains all of the information needed to perform a filesystem operation.
 */
class FileSystemRequest {
    /**
     * Creates a filesystem request.
     * @param {FileSystemRequestData} data The data to construct the request with
     */
    constructor(data) {
        this.async = data.isAsync;
        this.expr = data.expr;

        /** @type {string} */
        this.fileName = '';

        /** @type {string} */
        this.fullPath = '';

        /** @type {string} */
        this.relativePath = data.relPath || '';

        /** @type {FileSystem} */
        this.fileSystem = data.fs;

        /** @type {number} */
        this.flags = typeof data.flags === 'string' ? data.flags :
            typeof data.flags === 'number' ? data.flags : 0;

        /** @type {FileSystemStat} */
        this.parent = null;

        /** @type {string} */
        this.pathFull = '';

        /** @type {string} */
        this.pathRel = '';

        /** @type {boolean} */
        this.resolved = false;

        /** @type {string} */
        this.op = data.op || 'unknown';

        /** @type {FileSecurity} */
        this.securityManager = data.fs.securityManager;

        let expr = data.expr, relPath = data.relPath;

        //  Best guess for now
        if (!expr.endsWith('/')) {
            let dir = expr.slice(0, expr.lastIndexOf('/')),
                rel = relPath.slice(0, relPath.lastIndexOf('/'));

            this.fileName = expr.slice(dir.length + 1);
            this.fullPath = expr;
            this.relativePath = relPath;
            this.pathFull = dir + (dir.endsWith('/') ? '' : '/');
            this.pathRel = rel + (rel.endsWith('/') ? '' : '/');
        }
        else {
            this.fileName = '';
            this.fullPath = expr;
            this.relativePath = relPath;
            this.pathFull = expr;
            this.pathRel = relPath;
        }
    }

    clone(init) {
        let c = new FileSystemRequest({
            fs: this.fileSystem,
            flags: this.flags,
            op: this.op,
            expr: this.expr,
            relPath: this.relativePath,
            efuns: this.efuns
        });
        init(c);
        return c;
    }

    deny() {
        let procName = this.op.slice(0, 1).toLowerCase() +
            this.op.slice(1) + (this.async ? 'Async' : 'Sync');
        return this.securityManager.denied(procName, this.fullPath);
    }

    toString() {
        return `FileSystemRequest[${this.op}:${this.fullPath}]`;
    }

    async valid(method) {
        if (method && !method.startsWith('valid'))
            method = 'valid' + method;

        let checkMethod = method || `valid${this.op}`;

        if (typeof this.securityManager[checkMethod] !== 'function')
            throw new Error(`Security method ${checkMethod} not found!`);

        let result = await this.securityManager[checkMethod](this.fullPath);
        return result;
    }
}

/**
 * The file manager object receives external requests, creates internal requests,
 * and dispatches those requests to the file and security systems.  It then sends
 * the results back to the user (usually an efuns proxy instance).
 */
class FileManager extends MUDEventEmitter {
    /**
     * Construct the file manager
     */
    constructor() {
        super();

        /** 
         * Contains a cache of previously accessed directories
         * @type {Object.<string,DirectoryObject>} */
        this.directoryCache = {};

        /** @type {GameServer} */
        this.driver = driver;

        /** @type {Object.<string,FileSystem>} */
        this.fileSystems = {};

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
    async cloneObjectAsync(expr, args) {
        let req = this.createFileRequest('cloneObject', expr);
        if (!req.valid('LoadObject'))
            return req.deny();
        else
            return await req.fileSystem.cloneObjectAsync(req.relativePath, args || []);
    }

    /**
     * Create a directory asynchronously
     * @param {string} expr The directory to create
     * @param {number} flags Additional flags to control the operation
     */
    async createDirectoryAsync(expr, flags = 0) {
        let req = this.createFileRequest('CreateDirectory', expr, flags);
        if (!req.valid())
            return req.deny();
        else
            return await req.fileSystem.createDirectoryAsync(req.relativePath, req.flags);
    }

    /**
     * Create a filesystem object
     * @param {FileSystemStat} data The raw stat object from the filesystem
     * @param {Error} err Was there an error?
     */
    async createFileObjectAsync(data, err) {
        let result = false;

        if (efuns.isFunction(data.isDirectory))
            data.isDirectory = data.isDirectory();
        if (efuns.isFunction(data.isFile))
            data.isFile = data.isFile();
        if (efuns.isFunction(data.isBlockDevice))
            data.isBlockDevice = data.isBlockDevice();
        if (efuns.isFunction(data.isCharacterDevice))
            data.isCharacterDevice = data.isCharacterDevice();
        if (efuns.isFunction(data.isFIFO))
            data.isFIFO = data.isFIFO();
        if (efuns.isFunction(data.isSocket))
            data.isSocket = data.isSocket();
        if (efuns.isFunction(data.isSymbolicLink))
            data.isSymbolicLink = data.isSymbolicLink();

        if (data.isDirectory) {
            result = new DirectoryObject(data, undefined, err);
        }
        else if (data.isFile) {
            result = new FileObject(data, undefined, err);
        }
        else {
            result = new FileSystemStat(data, undefined, err);
        }
        return result;
    }

    /**
     * Create a filesystem object
     * @param {FileSystemStat} data The raw stat object from the filesystem
     * @param {Error} err Was there an error?
     */
    createFileObjectSync(data, err) {
        let result = false;

        if (efuns.isFunction(data.isDirectory))
            data.isDirectory = data.isDirectory();
        if (efuns.isFunction(data.isFile))
            data.isFile = data.isFile();
        if (efuns.isFunction(data.isBlockDevice))
            data.isBlockDevice = data.isBlockDevice();
        if (efuns.isFunction(data.isCharacterDevice))
            data.isCharacterDevice = data.isCharacterDevice();
        if (efuns.isFunction(data.isFIFO))
            data.isFIFO = data.isFIFO();
        if (efuns.isFunction(data.isSocket))
            data.isSocket = data.isSocket();
        if (efuns.isFunction(data.isSymbolicLink))
            data.isSymbolicLink = data.isSymbolicLink();

        if (data.isDirectory) {
            result = new DirectoryObject(data, undefined, err);
        }
        else if (data.isFile) {
            result = new FileObject(data, undefined, err);
        }
        else {
            result = new FileSystemStat(data, undefined, err);
        }
        return result;
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
        let { FileSystem, Path } = this.getFilesystem(expr);

        let result = new FileSystemRequest({
            fs: FileSystem,
            flags: flags,
            op: op || '',
            expr,
            relPath: Path
        });
        return result;
    }

    /**
     * Create the specified filesystem.
     * @param {MudlibFileMount} fsconfig The filesystem to mount.
     */
    async createFileSystem(fsconfig) {
        let fileSystemType = require(path.join(__dirname, fsconfig.type)),
            securityManagerType = require(path.join(__dirname, fsconfig.securityManager)),
            systemId = crypto.createHash('md5').update(fsconfig.mountPoint).digest('hex'),
            fileSystem = new fileSystemType(this, Object.assign({ systemId: systemId }, fsconfig.options), fsconfig.mountPoint),
            securityManager = new securityManagerType(this, fileSystem, fsconfig.securityManagerOptions);
        this.fileSystems[fsconfig.mountPoint] = fileSystem;
        return fileSystem;
    }

    /**
     * Generate a dummy stat.
     * @param {Error} err An error that occurred.
     * @param {FileSystemRequest} req The request associated with this stat
     */
    createDummyStats(err = false, req) {
        let dt = new Date(0);

        return new FileSystemStat({
            absolutePath: req.fullPath,
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
            name: req.fileName,
            path: req.fullPath || '',
            size: -1,
            rdev: -1,
            isBlockDevice: false,
            isCharacterDevice: false,
            isDirectory: false,
            isFIFO: false,
            isFile: false,
            isSocket: false,
            isSymbolicLink: false
        });
    }

    /**
     * Remove a directory from the filesystem.
     * @param {string} expr The directory to remove.
     * @param {{ flags: number }} options Any additional options.
     */
    async deleteDirectoryAsync(expr, options) {
        let req = this.createFileRequest('deleteDirectoryAsync', expr, options.flags);
        return req.valid('deleteDirectory') && await req.fileSystem.deleteDirectoryAsync(req.relativePath, req.flags);
    }

    /**
     * Delete/unlink a file from the filesystem.
     * @param {string} expr The path expression to remove.
     */
    async deleteFileAsync(expr, options = 0) {
        let req = this.createFileRequest('deleteFileAsync', expr, options.flags);
        return req.valid('validDeleteFile') && await req.fileSystem.deleteFileAsync(req);
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
     */
    async getDirectoryAsync(expr, flags = 0) {
        let req = this.createFileRequest('getDirectoryAsync', expr, options.flags);
        return req.valid('validGetDirectory') && await req.fileSystem.getDirectoryAsync(req);
    }

    /**
     * Locate the filesystem for the specified absolute path
     * @param {string} expr The directory expression
     * @returns {{FileSystem:FileSystem, Path:string}} Returns a filesystem or a filesystem and relative path if withRelativePath is true
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
        return { FileSystem: fileSystem, Path: relativePath };
    }

    /**
     * Locate file objects based on the given patterns.
     * The expressions should always start from the root and contain:
     *   - Double asterisk wildcard for recursive blooms
     *   - Single asterisk wildcards
     *   - Question marks for single characters
     * @param {Glob} options
     * @param {...string} expr One or more expressions to evaluate
     * @returns {FileSystemStat[]} Returns a collection of filesystem objects
     */
    async glob(options = 0, ...expr) {
        /** @type {string[]} */
        let args = [].slice.apply(arguments);
        /** @type {FileSystemStat[]} */
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
                    { FileSystem, Path } = this.getFilesystem(dir);

                if (pj === '**') {
                    //  At this point, get all files at or below this point of the tree
                    //  and convert the remaining file tokens into a regex
                    opts |= Glob.Recursive;

                    /** An additional list of directories to fetch content for
                     * @type {FileSystemStat[]} */
                    let dirStack = [];

                    let subset = await FileSystem.glob(Path, '*', opts);
                }
                else if (pj.indexOf('**') > -1)
                    throw new Error('Double asterisk must be a standalone token in expression');

                await FileSystem.glob(Path, pj, opts);
            }
        }
        return results;
    }

    /**
     * Load/Create an Access Control List (ACL)
     * @param {string} expr
     */
    async getFileACL(expr) {
        let parts = expr.split('/'),
            i = parts.length;

        while (i--) {
            let dir = parts.slice(0, i).join('/');
            let data = await this.readFileACL(dir);
            if (!data) {
                data = driver.driverCall('createAcl', dir);
                if (data != null) {
                    await data.save();
                }
            }
            if (data)
                return new FileACL(data);
        }
        return acl;
    }

    async readFileACL(expr) {
        let req = this.createFileRequest('ReadFileACL', expr);
        return await req.fileSystem.getFileACL(req.relativePath);

    }

    async isDirectoryAsync(expr) {
        let req = this.createFileRequest('isDirectory', expr, true, 0);
        return req.valid('validReadDirectory') && await req.fileSystem.isDirectoryAsync(req.relativePath);
    }

    /**
     * Check to see if the given expression is a file,
     * @param {string} expr The path expression to evaluate.
     * @param {number} flags Additional flags for the operation
     * @returns {boolean} True if the expression is a file.
     */
    isFile(expr, flags) {
        let req = this.createFileRequest('isFile', expr);
        if (!req.valid('validReadFile'))
            return req.deny();
        else
            return req.fileSystem.isFileSync(req.relativePath, flags);
    }

    /**
     * Load an object from disk.
     * @param {string} expr Information about what is being requested.
     * @param {any} args Data to pass to the constructor.
     * @param {number} flags Flags to control the operation
     * @returns {MUDObject} The loaded object... hopefully
     */
    async loadObjectAsync(expr, args, flags = 0) {
        let req = this.createFileRequest('LoadObject', expr, flags);
        if (!req.valid())
            return req.deny();
        else
            return await req.fileSystem.loadObjectAsync(req.relativePath, args || [], req.flags);
    }

    /**
     * Load an object from disk.
     * @param {string} expr Information about what is being requested.
     * @param {any} args Data to pass to the constructor.
     * @param {number} flags Flags to control the operation
     * @returns {MUDObject} The loaded object... hopefully
     */
    loadObjectSync(expr, args, flags = 0) {
        let req = this.createFileRequest('LoadObject', expr, flags);
        if (!req.valid())
            return req.deny();
        else
            return req.fileSystem.loadObjectSync(req.relativePath, args || [], req.flags);
    }

    async readDirectoryAsync(expr, flags = 0) {
        let req = this.createFileRequest('ReadDirectory', expr, flags);
        return req.valid('validReadDirectory') && await req.fileSystem.readDirectoryAsync(req.pathRel, req.fileName, req.flags);
    }

    /**
     * Reads a file from the filesystem.
     * @param {string} expr The file to try and read.
     * @returns {string} The content from the file.
     */
    async readFileAsync(expr) {
        let req = this.createFileRequest('readFileAsync', expr);
        return req.valid('validReadFile') && await req.fileSystem.readFileSync(req.relativePath);
    }

    /**
     * Read structured data from the specified location.
     * @param {string} expr The JSON file being read.
     * @param {function=} callback An optional callback for async mode.
     */
    async readJsonAsync(expr) {
        let req = this.createFileRequest('readJsonFile', expr);
        return req.valid('validReadFile') && await req.fileSystem.readJsonAsync(req.relativePath);
    }

    /**
     * Read structured data from the specified location.
     * @param {EFUNProxy} efuns The efuns instance making the call.
     * @param {string} expr The JSON file being read.
     * @param {function=} callback An optional callback for async mode.
     */
    readJsonFileSync(expr) {
        let req = this.createFileRequest('readJsonFile', expr);
        if (!req.valid('validReadFile'))
            return req.deny();
        else
            return req.fileSystem.readJsonFileSync(req.relativePath);
    }

    /**
     * Stat a file
     * @param {any} expr
     * @param {any} flags
     */
    async statAsync(expr, flags) {
        let req = this.createFileRequest('stat', expr, flags);
        if (!req.valid('validStatFile'))
            return req.deny();
        else {
            let result = this.directoryCache[req.fullPath];
            try {
                result = await req.fileSystem.statAsync(req.relativePath, req.flags);
                if (result.isDirectory)
                    this.directoryCache[req.fullPath] = result;
            }
            catch (err) {
                result = this.createDummyStats(err, req);
            }
            result = Object.freeze(await this.createFileObjectAsync(result));
            return result;
        }
    }

    /**
     * Stat a filesystem expression
     * @param {string} expr The expression to stat
     * @param {number} flags Flags to control the behavior
     */
    statSync(expr, flags) {
        let req = this.createFileRequest('stat', expr, flags);
        if (!req.valid('validReadFile'))
            return req.deny();
        else {
            let result = undefined;
            try {
                result = req.fileSystem.statSync(req.relativePath, req.flags);
                result.absolutePath = req.fullPath;
                result.exists = true;
            }
            catch (err) {
                result = this.createDummyStats(err, req.fullPath);
                result.absolutePath = req.fullPath;
            }
            result = Object.freeze(this.createFileObjectSync(result));
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
        let req = this.createFileRequest('WriteFile', expr, flags || 'w');
        return new Promise((resolve, reject) => {
            try {
                if (!req.valid())
                    reject(req.deny());
                else
                    resolve(req.fileSystem.writeFileAsync(req.relativePath, content, req.flags, encoding));
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * 
     * @param {string} expr The location to write data to
     * @param {string} content The block of JSON data to write
     * @returns {Promise<boolean>} An indication of success or failure
     */
    async writeJsonAsync(expr, content, flags = 0) {
        let req = this.createFileRequest('WriteFile', expr, false, 0, null);
        if (!req.valid())
            return req.deny();
        else
            return await req.fileSystem.writeJsonAsync(req.relativePath, content, req.flags);
    }
}

var
    /** @type {FileManager} */
    FileManagerInstance;

global.MUDFS = {
    GetDirFlags: {
        // FileFlags
        None: 0,
        Verbose: 1 << 0,
        Interactive: 1 << 1,

        // StatFlags
        Size: 1 << 9,
        Perms: 1 << 10,
        Content: 1 << 11,

        Files: 1 << 13,
        Dirs: 1 << 14,
        Implicit: 1 << 15,
        System: 1 << 16,
        Hidden: 1 << 17,

        GetChildren: 1 << 18,
        FullPath: 1 << 19,

        //  Size + Permissions
        Details: 1 << 9 | 1 << 10,

        //  Files + Dirs + Implicit
        Defaults: (1 << 13) | (1 << 14) | (1 << 15)
    },
    MkdirFlags: {
        None: 0,
        Verbose: 1,
        EnsurePath: 1 << 21,
        ExplicitPerms: 1 << 22,
        IgnoreExisting: 1 << 25
    },
    MoveFlags: {
        // FileFlags enum
        None: 0,
        Verbose: 1 << 0,
        Interactive: 1 << 1,

        Backup: 1 << 21,
        NoClobber: 1 << 22,
        Update: 1 << 23,
        SingleFile: 1 << 24
    },
    MoveOptions: {
        backupSuffix: '~',
        flags: 0,
        prompt: false,
        targetDirectory: '.'
    },
    StatFlags: {
        None: 0,
        Size: 1 << 9,
        Perms: 1 << 10,
        Content: 1 << 9 | 1 << 10
    }
};


// #endregion

module.exports = {
    FileManager: new FileManager(),
    FileSystem,
    FileSystemStat,
    DirectoryObject,
    FileObject,
    ObjectDataFile,
    FileACL,
    Glob: Object.freeze({
        /** No options specified */
        NoOptions: 0,
        /** Recursive search */
        Recursive: 1 << 1,
        /** Stay on single filesystem */
        SameFilesystem: 1 << 2,
        /** Include hidden files */
        IncludeHidden: 1 << 3
    }),
    StatFlags: Object.freeze({
        None: 0,
        Size: 1 << 9,
        Perms: 1 << 10,
        Content: 1 << 9 | 1 << 10
    })
};

