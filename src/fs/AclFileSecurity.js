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
    { BaseFileSecurity, BaseSecurityCredential, BaseSecurityGroup } = require('./BaseFileSecurity'),
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
     * @param {string} aclFilename
     */
    constructor(dirObj, aclFilename) {
        super();
        this.permissions = {};
        this.files = {};
        this.aclFile = dirObj.resolveRelativePath(aclFilename);
        this.directory = dirObj;
        this.directoryName = dirObj.path;
        this.inherits = true;
    }

    async aclExists() {

    }

    async can(flags) {
        return await efuns.security.guardedAsync(async () => {

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
        if (true === data instanceof DirectoryAcl) {

        }
        else if (typeof data === 'object') {
            if (typeof data.inherits === 'boolean')
                this.inherits = data.inherits;
            if (Array.isArray(data.permissions)) {
                data.permissions.forEach(blob => {
                    for (let [group, perms] of Object.entries(data.permissions)) {
                        this.permissions[group] = driver.securityManager.parsePerms(perms);
                    }
                });
            }
            else if (typeof data.permissions === 'object') {
                for (let [group, perms] of Object.entries(data.permissions)) {
                    this.permissions[group] = driver.securityManager.parsePerms(perms);
                }
            }
        }
    }

    async save() {
        await this.aclObj;
    }
}

class AclSecurityCredential extends BaseSecurityCredential {
    /**
     * Construct an ACL credential
     * @param {AclFileSecurity} manager
     * @param {{ IsUser: boolean, UserId: string, IsWizard: boolean, Groups: AclSecurityGroup[]}} data
     */
    constructor(manager, data) {
        super(data);

        this.#securityManager = manager;
    }

    /** @type {AclFileSecurity} */
    #securityManager;
}

class AclSecurityGroup extends BaseSecurityGroup {
    constructor(manager, id, name, description, members = []) {
        super(manager, id, name, description, members);
    }

    /**
     * Create a group
     * @param {AclFileSecurity} manager
     * @param {BaseSecurityGroup} data
     */
    static async createAsync(manager, data) {
        return new AclSecurityGroup(manager, data.gID, data.name, data.description, data.members);
    }
}

class WildcardAcl {
    constructor(aclInfo) {
        this.directory = aclInfo.directory;
        this.pattern = driver.efuns.buildFilenamePattern(aclInfo.directory, false);
        this.description = aclInfo.data.description || '[No Description]';
        this.permissions = {};
        for (let group of aclInfo.data.permissions) {
            for(let [key, value] of Object.entries(group)) {
                this.permissions[key] = driver.securityManager.parsePerms(value);
            }
        }
    }
}

class AclFileSecurity extends BaseFileSecurity {
    constructor(fileManager, options) {
        super(fileManager, options = Object.assign({
            aclFileName: '.acl',
            defaultGroupName: DefaultGroupName,
            systemGroupName: DefaultSystemName,
            createAclApply: 'aclCreateDefault',
            externalGroupFiles: [],
            getCredentialApply: 'aclGetCredential'
        }, options));

        /** @type {Object.<string, DirectoryAcl>} */
        this.aclCache = {};

        /** @type {string} */
        this.aclFileName = options.aclFileName || '.acl';

        /** @type {Object.<string, AclSecurityCredential>} */
        this.credentials = {};

        /** @type {Object.<string,AclSecurityGroup>} */
        this.groups = {};

        this.defaultGroupName = options.defaultGroupName || DefaultGroupName;
        this.systemGroupName = options.systemGroupName || DefaultSystemName;
        this.groupsFile = options.groupsFile || '';
        /** @type {Object.<string,number>} */
        this.permSets = {};
        this.permissionsFile = options.permissionsFile || '';
        this.getCredentialApply = options.getCredentialApply || 'aclGetCredential';
        this.createAclApply = options.createAclApply || 'aclCreateDefault';
        this.externalGroupFiles = options.externalGroupFiles || [];
        this.wildcardPermissions = [];
    }

    /**
     * Load and validate the initial security settings
     * @param {GameServer} masterObject
     */
    async bootstrap(masterObject) {
        if (this.bootstrapApply) {
            await super.bootstrap(masterObject);
        }
        if (!this.groupsFile)
            throw new Error('bootstrap() security module requires groups file');
        if (!this.permissionsFile)
            throw new Error('bootstrap() security module requires permissions file');

        await this.loadGroupsFile();
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
     * @param {FileSystemObject} fso
     */
    async createAcl(fso) {
        let initialAcl = await driver.callApplyAsync(this.createAclApply,
            typeof fso.directory === 'string' ? fso.directory : fso.directory.path);
        let acl = new DirectoryAcl(fso.directory, fso.name);

        acl.merge(initialAcl.data);

        return acl;
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
     * Get a MUD-safe representation of a security credential
     * @param {string} username
     */
    async getSafeCredentialAsync(username) {
        let creds = await this.getCredential(username);
        return creds.createSafeExport();
    }

    /**
     * Initialize permissions on the filesystem
     */
    async initSecurityAsync() {

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

    /**
     * Load an external group file
     * @param {string} prefix The value to prepend to each group ID
     * @param {FileSystemObject} file The file to load from
     */
    async loadExternalGroupsFile(prefix, file) {
        let groups = await file.readYamlAsync();

        if (!prefix.endsWith('\\'))
            prefix += '\\';

        for (let i = 0, names = Object.keys(groups); i < names.length; i++) {
            let name = names[i],
                groupId = prefix + (names[i].startsWith('$') ? names[i].slice(1) : names[i]),
                groupData = groups[name];

            if (groupId in this.groups)
                throw new Error(`Group ${groupId} is specified multiple times in ${file.path}`);

            if (!groupData.name || typeof groupData.name !== 'string')
                throw new Error(`Group #${i} in ${file.path} does not have a property 'name'`);

            if (groupData.members && !Array.isArray(groupData.members))
                throw new Error(`Group ${groupId} does not have a valid member collection`);

            groupData.gID = groupId;

            this.groups[groupId] = await AclSecurityGroup.createAsync(this, groupData);
        }
    }

    /**
     * Load groups defined in the system groups file
     */
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

            groupData.gID = name;

            this.groups[name] = await AclSecurityGroup.createAsync(this, groupData);
        }
        if (this.defaultGroupName in this.groups === false) {
            this.groups[this.defaultGroupName] = await AclSecurityGroup.createAsync(this, {
                gID: this.defaultGroupName,
                name: this.defaultGroupName,
                description: 'Default group in which all objects are members',
                members: []
            });
        }
    }

    /** 
     * Load initial ACL information
     */
    async loadPermissionsFile() {
        try {
            let perms = await efuns.fs.readYamlAsync(this.permissionsFile),
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

            permSets.forEach(ps => {
                let setName = ps.replace(/^PERMSET\s+/, '');
                this.permSets[setName] = this.parsePerms(perms[ps]);
            });

            for (let i = 0; i < dirList.length; i++) {
                if (driver.efuns.containsWildcard(dirList[i].directory)) {
                    this.wildcardPermissions.push(new WildcardAcl(dirList[i]));
                    continue;
                }
                let directory = await driver.fileManager.getObjectAsync(dirList[i].directory, 0, true);
                let aclFile = await directory.getObjectAsync(this.aclFileName);

                /** @type {AclDirectoryData} */
                let data = dirList[i].data;

                /** @type {DirectoryAcl} */
                let acl = aclFile.exists ?
                    await this.getAcl(aclFile, true) :
                    await this.createAcl(aclFile);

                if (!aclFile.exists) {
                    await acl.save();
                }
                else if (!acl.exists || data.fixupEnabled === true) {
                    await acl.merge(data);
                }
                else {

                }
                console.log(`Ensuring permissions for ${directory}`);
            }
        }
        catch (ex) {
            console.log(`Fatal error: Could not read permissions: ${ex.members}`);
        }
    }

    /**
     * Get a credential
     * @param {string} filename
     * @returns {AclSecurityCredential}
     */
    async getCredential(filename) {
        return await driver.driverCallAsync('getCredentialApply', async () => {
            /** @type {{ IsUser: boolean, UserId: string, IsWizard: boolean, Groups: string[]}} */
            let result = await driver.masterObject[this.getCredentialApply](filename);

            if (!result || typeof result !== 'object')
                throw new Error(`Master object ${driver.filename}.${this.getCredentialApply} did not return valid credentials for ${filename}`);

            if (result.UserId in this.credentials)
                return this.credentials[result.UserId];

            if (!Array.isArray(result.Groups))
                result.Groups = [];

            Object.keys(this.groups).forEach(gid => {
                let group = this.groups[gid];
                if (group.isMember(result.UserId, filename))
                    result.Groups.push(gid);
            });

            if (this.defaultGroupName)
                result.Groups.push(this.defaultGroupName);

            for (let i = 0; i < result.Groups.length; i++) {
                result.Groups[i] = await this.resolveGroupAsync(result.Groups[i]);
            }
            return (this.credentials[result.UserId] = new AclSecurityCredential(this, result));
        }, __filename, true, true);
    }

    /**
     * Parse permission string
     * @param {string} perms
     */
    parsePerms(perms) {
        let result = 0,
            parts = perms.split('');

        if (typeof perms === 'number') {
            return perms;
        }
        else if (perms in this.permSets) {
            return this.permSets[perms];
        }

        parts.forEach(p => {
            switch (p) {
                case 'c': result |= P_CREATEFILE; break;
                case 'C': result |= P_CREATEFILE | P_CREATEDIR; break;
                case 'd': result |= P_DELETE; break;
                case 'D': result |= P_DELETEDIR | P_DELETE; break;
                case 'm': result |= P_READMETADATA; break;
                case 'M': result |= P_READMETADATA | P_WRITEMETADATA; break;
                case 'O': result |= P_TAKEOWNERSHIP; break;
                case 'P': result |= P_CHANGEPERMS; break;
                case 'r': result |= P_READ | P_READPERMS; break;
                case 'R': result |= P_LISTDIR | P_READ | P_READPERMS; break;
                case 'w': result |= P_WRITE; break;
                case 'x': result |= P_EXECUTE; break;
            }
        });
        return result;
    }

    async resolveGroupAsync(groupName) {
        if (groupName in this.groups)
            return this.groups[groupName];
    }

    /**
     * Ensure the master object is compatible with this security manager.
     * @param {GameServer} gameDriver
     */
    async validateAsync(gameDriver) {
        if (typeof gameDriver.masterObject[this.getCredentialApply] !== 'function')
            throw new Error(`Master object ${driver.masterObject.filename} does not contain method '${this.getCredentialApply}'`);
        if (typeof gameDriver.masterObject[this.createAclApply] !== 'function')
            throw new Error(`Master object ${driver.masterObject.filename} does not contain method '${this.createAclApply}'`);

        for (const pattern of this.externalGroupFiles) {
            try {
                let externalFiles = await driver.fileManager.queryFileSystemAsync(pattern, true)
                    .catch(err => console.log(`Unable to locate external files using pattern ${pattern}: ${err}`));

                for (let i = 0; i < externalFiles.length; i++) {
                    try {
                        const prefix = await driver.callApplyAsync('aclGetExternalGroupPrefix', externalFiles[i].path);
                        await this.loadExternalGroupsFile(prefix, externalFiles[i])
                            .catch(err => console.log(`\tUnable to load external group file: ${externalFiles[i].path}: ${err}`));
                    }
                    catch (err) {
                        console.log(`\tUnable to load external group file: ${externalFiles[i].path}: ${err}`);
                    }
                }
            }
            catch (ex) {
                console.log(`Unable to locate external files using pattern ${pattern}: ${ex}`)
            }
        }
        await this.loadPermissionsFile();
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
