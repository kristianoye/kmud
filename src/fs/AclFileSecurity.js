/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * The ACL (Access Control List) security system defines a set of interfaces 
 * to allow for very granular control over MUD operations.  Every file in the
 * mudlib has an ACL that contains:
 * 
 *  - Usernames: Usernames are alphanumeric characters only
 *  
 *  - Groups: Groups are sets of users.  The name of the group is prefixed by
 *    the '$' character.  Group names may also contain one or more ':' 
 *    characters to define a namespace.  Example:
 *        $CREATOR:kriton
 *        $DOMAIN:shire
 *        
 *  - Filenames: Objects created from a file may be granted their own set of
 *    unique permissions.  File ACL entries start with a '/' path character 
 *    and must be absolute MUD paths.
 *    
 *  Each ACL entry contains a list of users, groups, and/or filenames along 
 *  with a set of security flags describing their respective level of access
 *  to the specified resource.
 *  
 *  Each ACL may also contain an arbitary collection of key:value pairs
 *  known as metadata.  Example metadata may include items such as:
 *      - Approval status
 *      - Object type (e.g., room, weapon, etc)
 */
const
    BaseFileSecurity = require('./BaseFileSecurity'),
    { FileSystemObject } = require('./FileSystemObject'),
    SecurityFlags = require('./SecurityFlags'),
    DefaultGroupName = '$ALL',
    DefaultSystemName = '$SYSTEM',
    P_READ = 1 << 0,
    P_WRITE = 1 << 1,
    P_DELETE = 1 << 2,
    P_DELETEDIR = 1 << 3,
    P_LISTDIR = 1 << 4,
    P_CREATEFILE = 1 << 5,
    P_CREATEDIR = 1 << 6,
    P_CHANGEPERMS = 1 << 7,
    P_READPERMS = 1 << 8,
    P_TAKEOWNERSHIP = 1 << 9,
    P_READMETADATA = 1 << 10,
    P_WRITEMETADATA = 1 << 11,
    P_VIEWSYSTEMFILES = 1 << 12,
    P_LOADOBJECT = 1 << 13,
    P_EXECUTE = 1 << 14,
    P_DESTRUCTOBJECT = 1 << 15;

/**
 * @typedef {Object} AclDirectoryData
 * @property {string} description The description of the directory
 * @property {boolean} [fixupEnabled] Ensure data from perms file exists in ACL regardless of current state
 * @property {Object.<string,string>[]} permissions A mapping of groups and objects and their permissions
 */

class BaseAcl {
    constructor() {
        this.#inherits = true;
        this.#metdata = {};
    }

    async can(flags) {

    }

    /** @type {boolean} */
    #inherits;

    get inherits() {
        return this.#inherits;
    }

    set inherits(val) {
        if (typeof val === 'boolean')
            this.#inherits = val;
    }

    /** @type {Object.<string,any>} */
    #metdata;

    async getMetadata() {
        if (await this.can(SecurityFlags.P_READMETADATA)) {
            return Object.assign({}, this.metdata);
        }

    }

    /**
     * The permission to string
     * @param {string} str
     */
    static parseAclString(str) {
        let flags = 0;

        if (!str || typeof str !== 'string')
            flags = 0;
        else if (str.toUpperCase() === 'FULL')
            flags = P_READ | P_WRITE | P_DELETE | P_LISTDIR | P_EXECUTE |
                P_CREATEFILE | P_CREATEDIR | P_CHANGEPERMS |
                P_READPERMS | P_TAKEOWNERSHIP | P_READMETADATA |
                P_WRITEMETADATA | P_VIEWSYSTEMFILES | P_LOADOBJECT;
        else if (str.toUpperCase() === 'NONE')
            flags = 0;
        else
            flags = str
                .split('')
                .map(c => {
                    switch (c) {
                        case 'r': return P_READ;
                        case 'R': return P_READ | P_LISTDIR;

                        case 'w': case 'W': return P_WRITE;

                        case 'c': return P_CREATEFILE;
                        case 'C': return P_CREATEDIR | P_CREATEFILE;

                        case 'd': return P_DELETE;
                        case 'D': return P_DELETE | P_DELETEDIR;

                        case 'P': return P_CHANGEPERMS | P_READPERMS;
                        case 'p': return P_READPERMS;

                        case 'm': return P_READMETADATA;
                        case 'M': return P_WRITEMETADATA | P_READMETADATA;

                        case 'x': return P_EXECUTE;
                        case 'L': return P_LOADOBJECT;

                        case 'O': return P_TAKEOWNERSHIP;
                        case 'S': return P_VIEWSYSTEMFILES;

                        case '-': return 0;

                        default: throw new Error(`Illegal permissions character: ${c}`);
                    }
                })
                .sum();

        return flags;
    }

    /**
     * Converts a bitset into a more readable string.
     * @param {number} flags The flags to convert
     */
    static toAclString(flags) {
        let bits = [
            [P_READ, 'r'],
            [P_WRITE, 'w'],
            [P_DELETE, 'd'],
            [P_LISTDIR, 'L'],
            [P_EXECUTE, 'x'],
            [P_CREATEFILE, 'c'],
            [P_CREATEDIR, 'C'],
            [P_CHANGEPERMS, 'P'],
            [P_READPERMS, 'p'],
            [P_TAKEOWNERSHIP, 'O'],
            [P_READMETADATA, 'm'],
            [P_WRITEMETADATA, 'M'],
            [P_VIEWSYSTEMFILES, 'S'],
            [P_LOADOBJECT, 'l']
        ];

        let result = bits
            .map(s => (s[0] & flags) > 0 ? s[1] : '-')
            .join('');

        return result;
    }
}

class FileAcl extends BaseAcl {
    constructor(parent) {
        super();
        this.metadata = {};
    }
}

class DirectoryAcl extends BaseAcl {
    /**
     * Construct a directory ACL
     * @param {FileSystemObject} dirObj
     * @param {any} aclFilename
     */
    constructor(dirObj, aclFilename) {
        super();
        this.permissions = {};
        this.files = {};
        this.aclFile = dirObj.resolveRelativePath(aclFilename);
        this.directory = dirObj;
        this.directoryName = dirObj.fullPath;
    }

    async aclExists() {

    }

    async can(flags) {
        return await efuns.security.guarded(async () => {

        });
    }

    async load() {
        this.aclObj = await driver.fileManager.getObjectAsync(this.aclFile, 0, true);

        if (this.aclObj.exists) {
            let data = await this.aclObj.readJsonAsync();
        }
        else {
            let data = await driver.securityManager.createAcl(this);
            this.inherits = data.inherits !== false;

            return await this.save();
        }
        return this;
    }

    /**
     * Merge data into this Acl object
     * @param {DirectoryAcl|AclDirectoryData} data
     */
    async merge(data) {
        let hasChanged = false;

        if (true === data instanceof DirectoryAcl) {

        }
        else if (Array.isArray(data.permissions)) {
            data.permissions.forEach(blob => {
                Object.keys(blob).forEach(id => {
                    let perms = BaseAcl.parseAclString(blob[id]);
                    if (false === id in this.permissions || this.permissions[id] !== perms) {
                        this.permissions[id] = perms;
                        hasChanged = true;
                    }
                })
            });
        }
        if (hasChanged === true)
            await this.save();
    }

    async save() {
        await this.aclObj;
    }
}

class AclSecurityGroup {
    constructor(data, index) {
        this.index = index;
        this.#name = data.name;
        this.#description = data.description || '[No Description]';
        /** @type {string[]} */
        this.#members = (data.members || []).map(n => n.toLowerCase());
    }

    static async createAsync(data) {
        return new AclSecurityGroup(data);
    }

    /** @type {string} */
    #description;

    get description() {
        return this.#description;
    }

    /**
     * Determine if the specified user is a member of the group
     * @param {string} user The user ID
     */
    isMember(user) {
        return this.#members.findIndex(m => m === user) > -1;
    }

    /** @type {string[]} */
    #members;

    get members() {
        return this.#members.slice(0);
    }

    /** @type {string} */
    #name;

    get name() {
        return this.#name;
    }
}

class AclFileSecurity extends BaseFileSecurity {
    constructor(fileManager, options) {
        super(fileManager, options = Object.assign({
            aclFileName: '.acl',
            bootstrapApply: 'bootstrapAclSecurity',
            defaultGroupName: DefaultGroupName,
            systemGroupName: DefaultSystemName,
            createAclApply: 'aclCreate',
            getCredentialApply: 'aclGetCredential'
        }, options));

        /** @type {Object.<string, DirectoryAcl>} */
        this.aclCache = {};

        /** @type {string} */
        this.aclFileName = options.aclFileName || '.acl';

        /** @type {Object.<string,AclSecurityGroup>} */
        this.groups = {};

        this.defaultGroupName = options.defaultGroupName || DefaultGroupName;
        this.systemGroupName = options.systemGroupName || DefaultSystemName;
        this.groupsFile = options.groupsFile || '';
        this.permissionsFile = options.permissionsFile || '';
        this.getCredentialApply = options.getCredentialApply || 'aclGetCredential';
        this.createAclApply = options.createAclApply || 'aclCreate';
    }

    /**
     * Load and validate the initial security settings
     * @param {GameServer} masterObject
     */
    async bootstrap(masterObject) {
        let settings = await super.bootstrap(masterObject);

        if (typeof settings.groupsFile === 'string')
            this.groupsFile = settings.groupsFile;
        if (typeof settings.permissionsFile === 'string')
            this.permissionsFile = settings.permissionsFile;

        if (!this.groupsFile)
            throw new Error('bootstrap() security module requires groups file');
        if (!this.permissionsFile)
            throw new Error('bootstrap() security module requires permissions file');

        if (typeof driver.masterObject[this.getCredentialApply] !== 'function')
            throw new Error(`Master object ${driver.masterObject.filename} does not contain method '${this.getCredentialApply}'`);
        if (typeof driver.masterObject[this.createAclApply] !== 'function')
            throw new Error(`Master object ${driver.masterObject.filename} does not contain method '${this.createAclApply}'`);

        await this.loadGroupsFile();
        await this.loadPermissionsFile();
    }

    /**
     * Check to see if the type of action is allowed in the current context.
     * @param {FileSystemObject} fo
     * @param {number} flags The flags describing the desired I/O operation
     */
    async can(fo, flags) {
        //  !!! TODO: FIX THIS AFTER PERMISSIONS ACTUALLY WORK !!!
        // return true;

        return new Promise(async (resolve, reject) => {
            try {
                //  Everything is read-write until the master object is loaded
                if (driver.gameState < 2)
                    return resolve(true);

                let acl = await this.getAcl(fo);
                resolve(await acl.can(flags));
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Create a non-existant directory ACL
     * @param {DirectoryAcl} acl
     */
    async createAcl(acl) {
        return await driver.callApplyAsync(this.createAclApply, acl.directoryName);
    }

    /**
     * Get the Access Control List for the specified object.
     * @param {FileSystemObject|string} fo The stat to get an Acl for
     * @returns {Promise<BaseAcl>}
     */
    async getAcl(fo, ignoreParent = false) {
        if (typeof fo === 'string') {
            fo = await driver.fileManager.getObjectAsync(fo, 0, true);
        }
        return new Promise(async (resolve, reject) => {
            if (fo.isFile) {
                let parent = await fo.getParent(),
                    parentAcl = await this.getAcl(parent);

                return resolve(parentAcl);
            }
            else if (fo.isDirectory) {
                if (fo.path in this.aclCache)
                    return resolve(this.aclCache[fo.path]);

                /** @type {DirectoryAcl} */
                let acl = new DirectoryAcl(fo, this.aclFileName);

                await acl.load();

                return resolve(this.aclCache[fo.path] = acl);
            }
            else if (!fo.exists && ignoreParent === false)
            {
                //  Look for the first parent that does exist

            }
            else
                reject(`Invalid request:`)
        });
    }

    /**
     * Is the file a system file?
     * @param {FileSystemObject} file
     */
    isSystemFile(file) {
        if (file.fullPath === this.groupsFile) return true;
        else if (file.fullPath === this.permissionFile) return true;
        else if (file.name === this.aclFileName) return true;
        else return super.isSystemFile(file);
    }

    async loadGroupsFile() {
        let groups = await efuns.fs.readYamlAsync(this.groupsFile);

        for (let i = 0, names = Object.keys(groups); i < names.length; i++) {
            let name = names[i],
                groupData = groups[name];

            if (name === 'DEFAULT GROUP NAME') {
                this.defaultGroupName = groupData;
                continue;
            }
            if (name === 'SYSTEM GROUP NAME') {
                this.systemGroupName = groupData;
                continue;
            }
            if (name in this.groups)
                throw new Error(`Group ${name} is specified multiple times in ${this.groupsFile}`);

            if (!groupData.name || typeof groupData.name !== 'string')
                throw new Error(`Group #${i} in ${this.groupsFile} does not have a property 'name'`);

            if (groupData.members && !Array.isArray(groupData.members))
                throw new Error(`Group ${name} does not have a valid member collection`);

            this.groups[name] = await AclSecurityGroup.createAsync(groupData);
        }
    }

    async loadPermissionsFile() {
        try {
            let perms = await efuns.fs.readYamlAsync('/sys/etc/acl-access.yaml'),
                permSets = Object.keys(perms).filter(p => p.startsWith('PERMSET')),
                dirList = Object.keys(perms)
                    .filter(p => p.startsWith('DIRECTORY'))
                    .map(k => {
                        return {
                            directory: k.substring('DIRECTORY'.length + 1).trim(),
                            data: perms[k]
                        }
                    }),
                acl;

            for (let i = 0; i < dirList.length; i++) {
                let dirName = dirList[i].directory;
                /** @type {AclDirectoryData} */
                let data = dirList[i].data;
                /** @type {DirectoryAcl} */
                let acl = await this.getAcl(dirName, true);

                if (!acl) {

                }
                else if (!acl.exists || data.fixupEnabled === true) {
                    await acl.merge(data);
                }
                else {

                }
                console.log(`Ensuring permissions for ${dirName}`);
            }
        }
        catch (ex) {
            console.log(`Fatal error: Could not read permissions: ${ex.members}`);
        }
    }

    async getCredential(filename) {
        let keyId = await driver.driverCallAsync('getCredentialApply', async () => {
            /** @type {{ IsUser: boolean, UserId: string, groups: string[]}} */
            let result = await driver.masterObject[this.getCredentialApply](filename);
            if (!result || typeof result !== 'object')
                throw new Error(`Master object ${driver.filename}.${this.getCredentialApply} did not return valid credentials for ${filename}`);

            result.groups = [];

            if (result.IsUser || result.UserId.startsWith('$')) {
                Object.keys(this.groups).forEach(gid => {
                    let group = this.groups[gid];
                    if (group.isMember(result.UserId))
                        result.groups.push(gid);
                });
            }
            return result;
        }, __filename, true, true);
    }

   /**
     * Check to see if the caller may append to file.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validAppendFile(efuns, req) {
        return this.validWriteFile(efuns, req);
    }

    /**
     * Determine whether the caller is allowed to create a directory.
     * @param {string} expr The directory being created.
     */
    validCreateDirectory(expr) {
        return this.validWriteFile(expr);
    }

    /**
     * Default security does not distinguish creating a file from writing.
     * @param {string} expr The expression to create
     */
    validCreateFile(expr) {
        return this.validWriteFile(expr);
    }

    /**
     * Determine if the caller is permitted to remove a particular directory.
     * @param {string} expr The directory to delete
     */
    validDeleteDirectory(expr) {
        return this.validWriteFile(expr);
    }

    /**
     * Default security does not distinguish deleting a file from writing.
     * @param {string} expr The path to delete
     */
    validDeleteFile(expr) {
        return this.validWriteFile(expr);
    }

    /**
     * Default security does not restrict object destruction.
     * @param {FileSystemRequest} expr
     */
    validDestruct(expr) {
        return true;
    }

    /**
     * Determine if the user has access to the specified directory.
     * @param {any} expr
     */
    validGetDirectory(expr) {
        return true;
    }

    /**
     * Default security system does not support granting permissions.
     */
    validGrant(expr) {
        throw new Error('Security system does not support the use of grant');
    }

    /**
     * Default security does not enforce object loading or cloning.
     * @param {string} expr The path to load the object from.
     */
    validLoadObject(expr) {
        return this.validReadFile(expr);
    }

    /**
     * Default security does not distinguish between file and directory reads.
     * @param {EFUNProxy} efuns The proxy requesting the directory listing.
     * @param {FileSystemRequest} req The path expression to try and read.
     */
    async validReadDirectory(req) {
        return await this.validReadFile(req);
    }

    /**
     * Perform a security check
     * @param {DirectoryObject} stat The stat object to check
     */
    async validReadDirectoryAsync(stat) {
        if (!stat.isDirectory)
            throw new Error(`Bad argument 1 to validReadDirectoryAsync; Expected DirectoryObject got ${stat.constructor.name}`);
        return true; // BOGUS... but does not work yet
    }

    /**
     * Determine if the caller has permission to read a particular file.
     * @param {string} filename The file to read from
     * @returns {boolean} True if the operation can proceed.
     */
    async validReadFile(filename) {
        return await driver.getExecution()
            .guarded(async f => await driver.validRead(f, filename));
    }

    /**
     * Default security treats filestat as a normal read operation.
     * @param {string} filename The name of the file to stat
     * @returns {boolean} True if the operation can proceed.
     */
    validStatFile(filename) {
        return this.validReadFile(filename);
    }

    /**
     * Determine if the caller has permission to write to the filesystem.
     * @param {string} expr The path to write to
     * @returns {boolean} Returns true if the operation is permitted.
     */
    validWriteFile(expr) {
        return driver.getExecution()
            .guarded(f => driver.validWrite(f, expr));
    }
}

module.exports = { AclFileSecurity };
