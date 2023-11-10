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
    { BaseSecurityCredential, BaseSecurityGroup, BaseSecurityManager } = require('./BaseSecurityManager'),
    { FileSystemObject } = require('../fs/FileSystemObject'),
    SecurityFlags = require('./SecurityFlags'),
    DefaultGroupName = '$ALL',
    DefaultSystemName = '$SYSTEM',
    path = require('path/posix');

/** @type {AclSecurityManager} */
var securityManager;

/**
 * @typedef {Object} AclDirectoryData
 * @property {string} description The description of the directory
 * @property {boolean} [fixupEnabled] Ensure data from perms file exists in ACL regardless of current state
 * @property {Object.<string,string>[]} permissions A mapping of groups and objects and their permissions
 * 
 * @typedef {Object} AclEffectivePermission
 * @property {string} source The ACL file that defines the permission
 * @property {number} perms The permissions allowed
 */

class SecurityAcl {
    /**
     * Construct a security ACL
     * @param {SecurityAcl} parent The parent ACL if one exists
     * @param {boolean} isDirectory Is this ACL for a directory?
     * @param {string} aclFilename The path to the ACL file that stores the data
     * @param {SecurityAcl} aclData The ACL data
     */
    constructor(parent, isDirectory, aclFilename, aclData = {}) {
        if (isDirectory) {
            this.#children = {};

            for (let [fileName, data] of Object.entries(aclData.children || {})) {
                let child = new SecurityAcl(this, false, aclFilename, data);
                this.#children[fileName] = child;
            }
        }
        else
            this.#children = false;
        this.#filename = aclFilename;
        this.#inherits = typeof aclData.inherits === 'boolean' ? aclData.inherits : true;
        this.#metadata = aclData.metadata || {};
        this.#owner = aclData.owner;
        this.#parent = parent || false;

        //  YAML data comes in as an array
        if (Array.isArray(aclData.permissions)) {
            this.#permissions = {};
            aclData.permissions.forEach(p => {
                for (const [id, perm] of Object.entries(p)) {
                    this.#permissions[id] = securityManager.parsePerms(perm);
                }
            });
        }
        else
            this.#permissions = aclData.permissions || {};
    }

    //#region Properties

    /**
     * Child objects contained within this ACL or false if this is not a file
     * @type {Object.<string,SecurityAcl> | false}
     */
    #children;

    /**
     * The location at which this ACL lives on the filesystem
     * @type {string}
     */
    #filename;

    get filename() {
        return this.#filename;
    }

    /** 
     * If true, then this ACL will check its parent ACL if perms are not
     * sufficient to perform the task.
     * @type {boolean}
     */
    #inherits;

    /**
     * If true, then this ACL will check its parent ACL if perms are not
     * sufficient to perform the task.
     * @type {boolean}
     */
    get inherits() {
        return this.#inherits;
    }

    /**
     * 
     */
    #metadata;

    /**
     * Who is the assigned owner of the file?
     * @type {string}
     */
    #owner;

    /**
     * The parent ACL
     * @type {SecurityAcl}
     */
    #parent;

    /**
     * Who is the assigned owner of the file?
     * @type {string}
     */
    get owner() {
        return this.#owner || (this.#parent ? this.#parent.owner : false);
    }

    #permissions;

    //#endregion

    //#region Methods

    /**
     * Is the requested operation permitted under current context?
     * @param {boolean} flags
     */
    async can(flags) {
        try {
            let ecc = driver.getExecution(),
                perms = await this.getEffectivePermissions();

            //  Silently inject wildcard perms
            securityManager.applyWildcardAcls(perms);

            let result = await ecc.guarded(frame => {
                if (frame.object) {
                    /** @type {{ userId: string, groups: string[] }} */
                    let $creds = frame.object.$credential;

                    //  Owner always succeeds
                    if (this.owner === $creds.userId)
                        return true;

                    //  System group always succeeds
                    if (securityManager.systemGroupName && $creds.groups.indexOf(securityManager.systemGroupName) > -1)
                        return true;

                    //  Calculate effective permissions
                    let ep = 0;
                    for (const [id, data] of Object.entries(perms)) {
                        if ($creds.groups.indexOf(id) > -1)
                            ep |= data.perms;
                    }
                    if ((flags & ep) === flags)
                        return true;
                }
                else {
                    console.log('need something here');
                }
                return false;
            });

            return result;
        }
        catch (err) {
            console.log(`!!! CRITICAL !!! Permission check failure: ${err}\n${err.stack}`);
        }
        return false;
    }

    /**
     * Get a file-specific ACL
     * @param {string} name The name of the file for which we want an ACL
     * @returns {Promise<SecurityAcl> | false}
     */
    async getChildAsync(name) {
        if (typeof this.#children === 'object') {
            //  Does this entry have an explicit entry?
            if (name in this.#children)
                return this.#children[name];
            else {
                return (this.#children[name] = new SecurityAcl(this, false, this.filename, { inherits: true }));
            }
        }
        return false;
    }

    /**
     * Get the effective permissions
     * @param {Object.<string,AclEffectivePermission} result
     * @returns {Object.<string,AclEffectivePermission}
     */
    async getEffectivePermissions(result = {}) {
        for (const [id, perms] of Object.entries(this.#permissions)) {
            //  Do not overwrite permissions inherited from a higher level
            if (false === id in result) {
                result[id] = {
                    perms: perms,
                    source: this.filename
                };
            }
        }
        if (this.inherits && this.#parent)
            await this.#parent.getEffectivePermissions(result);

        return result;
    }

    /**
     * Save the ACL data to file
     */
    async saveAsync() {
        if (this.#children === false) {
            await this.#parent.saveAsync();
        }
        else {
            let aclFile = await driver.fileManager.getFileAsync(this.filename, 0, true);
            let exportChildren = () => {
                let result = {};
                for (const [fileName, acl] of Object.entries(this.#children)) {
                    result[fileName] = {
                        inherits: typeof acl.inherits === 'boolean' ? acl.inherits : true,
                        owner: acl.owner || this.owner,
                        permissions: acl.#permissions || {}
                    };
                }
                return result;
            };

            await aclFile.writeJsonAsync({
                children: exportChildren(),
                filename: this.filename,
                inherits: this.inherits,
                metdata: this.#metadata,
                owner: this.owner,
                permissions: this.#permissions,
            });
        }
    }

    /**
     * Set ACL permissions
     * @param {SecurityAcl} perms
     * @param {string} [filename]
     */
    async setPermissionsAsync(perms, filename = false) {
        if (await this.can(SecurityFlags.P_CHANGEPERMS)) {
            /** @type {SecurityAcl} */
            let aclToModify = filename ? await this.getChildAsync(filename) : this;

            aclToModify.#permissions = perms.permissions;
            if (typeof perms.inherits === 'boolean')
                aclToModify.#inherits = perms.inherits;

            await aclToModify.saveAsync();

            return true;
        }
        return false;
    }

    //#endregion
}

class AclSecurityCredential extends BaseSecurityCredential {
    /**
     * Construct an ACL credential
     * @param {AclSecurityManager} manager
     * @param {{ IsUser: boolean, UserId: string, IsWizard: boolean, Groups: AclSecurityGroup[]}} data
     */
    constructor(manager, data) {
        super(data);

        this.#securityManager = manager;
    }

    /** @type {AclSecurityManager} */
    #securityManager;
}

class AclSecurityGroup extends BaseSecurityGroup {
    constructor(manager, id, name, description, members = []) {
        super(manager, id, name, description, members);
    }

    /**
     * Create a group
     * @param {AclSecurityManager} manager
     * @param {BaseSecurityGroup} data
     */
    static async createAsync(manager, data) {
        return new AclSecurityGroup(manager, data.gID, data.name, data.description, data.members);
    }
}

class WildcardAcl {
    constructor(aclInfo) {
        this.directory = aclInfo.directory;
        /** @type {RegExp} */
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

class AclSecurityManager extends BaseSecurityManager {
    constructor(fileManager, options) {
        super(fileManager, options = Object.assign({
            aclFileName: 'acl.json',
            defaultGroupName: DefaultGroupName,
            systemGroupName: DefaultSystemName,
            createAclApply: 'aclCreateDefault',
            externalGroupFiles: [],
            getCredentialApply: 'aclGetCredential'
        }, options));

        if (securityManager)
            throw new Error('Illegal call; Cannot re-created security manager instance');

        /** @type {Object.<string, SecurityAcl>} */
        this.aclCache = {};

        /** @type {string} */
        this.aclFileName = options.aclFileName || 'acl.json';

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
        this.getFileOwnerApply = options.getFileOwnerApply || 'getFileOwner';
        this.createAclApply = options.createAclApply || 'aclCreateDefault';
        this.externalGroupFiles = options.externalGroupFiles || [];
        this.shadowFilesystem = options.shadowFilesystem || false;

        /** @type {WildcardAcl[]} */
        this.wildcardPermissions = [];
        securityManager = this;
    }

    /**
     * Apply wildcard ACLs
     * @param {SecurityAcl} acl
     */
    applyWildcardAcls(acl) {
        this.wildcardPermissions.forEach(wc => {
            if (wc.directory === '*') {
                for (const [id, perm] of Object.entries(wc.permissions)) {
                    if (id in acl)
                        acl[id].perms |= perm;
                    else
                        acl[id] = { perms: perm, source: this.permissionsFile };
                }
            }
        });
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
        return new Promise(async (resolve, reject) => {
            try {
                //  Everything is read-write until the master object is loaded
                if (!driver.masterObject)
                    return resolve(true);

                let ecc = driver.getExecution();
                let acl = await this.getAcl(fo);
                
                let result = await acl.can(flags);
                resolve(result);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Get the Access Control List for the specified object.
     * @param {FileSystemObject|string} fo The stat to get an Acl for
     * @returns {Promise<SecurityAcl>}
     */
    async getAcl(fo, ignoreParent = false) {
        if (typeof fo === 'string') {
            return await this.getAcl(await driver.fileManager.getFileAsync(fo, 0, true));
        }
        return new Promise(async (resolve, reject) => {
            if (fo.isFile) {
                let parent = await fo.getParentAsync(),
                    parentAcl = await this.getAcl(parent);

                return resolve(await parentAcl.getChildAsync(fo.name));
            }
            else if (fo.isDirectory) {
                try {
                    if (fo.path in this.aclCache)
                        return resolve(this.aclCache[fo.path]);
                    let aclFilename = await this.getAclFilename(fo);
                    let aclFile = await driver.fileManager.getFileAsync(aclFilename, 0, true);
                    let existingData = aclFile.exists ? await this.readAclData(aclFilename) : false;
                    let parentAcl = fo.parent ? await this.getAcl(fo.parent) : false;
                    let requireSave = !aclFile.exists;

                    //  There was no data for this directory; Ask the master
                    if (existingData === false) {
                        existingData = await driver.callApplyAsync(this.createAclApply, fo.fullPath);
                    }

                    if (!existingData.owner)
                        existingData.owner = await driver.callApplySync(this.getFileOwnerApply, fo.fullPath, fo.isDirectory);

                    /** @type {SecurityAcl} */
                    let acl = new SecurityAcl(parentAcl, true, aclFile.fullPath, existingData);

                    if (requireSave)
                        await acl.saveAsync();

                    return resolve(this.aclCache[fo.path] = acl);
                }
                catch (err) {
                    reject(err);
                }
            }
            else if (!fo.exists && ignoreParent === false)
            {
                //  Look for the first parent that does exist
                let parent = await fo.getParentAsync(),
                    parentAcl = await this.getAcl(parent);

                return resolve(await parentAcl.getChildAsync(fo.name));
            }
            else
                reject(`Invalid request:`)
        });
    }

    /**
     * Get the filename of the ACL file for the provided object
     * @param {FileSystemObject} fso
     * @returns string The full MUD path of the ACL file
     */
    async getAclFilename(fso) {
        if (this.shadowFilesystem) {
            const aclPath = fso.isDirectory ?
                path.join(this.shadowFilesystem, fso.fullPath.slice(1)) :
                path.join(this.shadowFilesystem, fso.directory.slice(1));
            let aclDir = await driver.fileManager.getFileAsync(aclPath, 0, true);

            if (!aclDir.exists) {
                await aclDir.createDirectoryAsync(true);
            }
            return path.join(aclPath, this.aclFileName);
        }
        else {
            const aclPath = fso.isDirectory ?
                path.join(fso.fullPath, this.aclFileName) :
                path.join(fso.directory, this.aclFileName);
            return aclPath;
        }
    }

    /**
     * Fetch a particular group
     * @param {string} groupName
     */
    getGroup(groupName) {
        return this.groups[groupName];
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
        if (this.shadowFilesystem !== false) {
            let shadowFS = await driver.fileManager.getFileAsync(this.shadowFilesystem, 0, true);
            if (!shadowFS.exists) {
                console.log(`Creating shadow volumne: ${shadowFS.fullPath}`);
                await shadowFS.createDirectoryAsync(true);
            }
        }
    }

    /**
     * Check to see if the specified user is a member of a particular group
     * @param {string} userId
     * @param {string} groupName
     */
    isGroupMember(userId, groupName) {
        let group = this.getGroup(groupName);
        return group.isMember(userId);
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
                    .filter(p => p.startsWith('DIRECTORY') || p.startsWith('FILE'))
                    .map(k => {
                        if (k.startsWith('DIRECTORY'))
                            return {
                                directory: k.substring('DIRECTORY'.length + 1).trim(),
                                data: perms[k]
                            };
                        else
                            return {
                                file: k.substring('FILE'.length + 1).trim(),
                                data: perms[k]
                            };
                    }),
                acl;

            permSets.forEach(ps => {
                let setName = ps.replace(/^PERMSET\s+/, '');
                this.permSets[setName] = this.parsePerms(perms[ps]);
            });

            console.log('Ensuring security ACLs are up-to-date:');
            for (let i = 0; i < dirList.length; i++) {
                let aclData = dirList[i];

                try {
                    if (driver.efuns.containsWildcard(aclData.directory)) {
                        this.wildcardPermissions.push(new WildcardAcl(dirList[i]));
                        continue;
                    }
                    /** @type {FileSystemObject} */
                    let fso = await driver.fileManager.getFileAsync(aclData.directory || aclData.file, 0, true);

                    aclData.data = Object.assign({
                        permissions: {},
                        description: 'No description',
                        inherits: true
                    }, aclData.data);

                    if (aclData.directory) {
                        if (!fso.isDirectory && fso.exists)
                            throw new Error(`AclSecurityManager: File object: ${fso.fullPath} is not a directory`);
                        else if (fso.exists) {
                            console.log(`\tEnsuring permissions for directory: ${fso.path}`);

                            const aclFilename = await this.getAclFilename(fso);
                            let aclFile = await driver.fileManager.getFileAsync(aclFilename, 0, true), // await fso.getFileAsync(this.aclFileName),
                                existingData = await this.readAclData(aclFile.fullPath),
                                parentAcl = fso.parent ? await this.getAcl(fso.parent) : false;

                            /** @type {AclDirectoryData} */
                            let data = Object.assign(existingData, aclData.data);

                            if (!data.owner)
                                data.owner = await driver.callApplyAsync(this.getFileOwnerApply, fso.fullPath);

                            /** @type {SecurityAcl} */
                            let acl = this.aclCache[fso.fullPath] = new SecurityAcl(parentAcl, true, aclFile.fullPath, data);

                            await acl.saveAsync();
                        }
                        else
                            console.log(`\tWARNING: Skipping permissions for missing directory: ${fso.path}`);
                    }
                    else {
                        let parentAcl = await this.getAcl(await fso.getParentAsync());
                        console.log(`\tEnsuring permissions for file: ${aclData.file}`);
                        await parentAcl.setPermissionsAsync(aclData.data, fso.name);

                    }
                }
                catch (err) {
                    console.log(`\tWARNING: Error setting permissions for directory: ${dirList[i].directory}: ${err}`);
                }
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
    getCredential(filename) {
        return driver.driverCall('getCredentialApply', () => {
            /** @type {{ IsUser: boolean, UserId: string, IsWizard: boolean, Groups: string[]}} */
            let result = driver.masterObject[this.getCredentialApply](filename);

            if (!result || typeof result !== 'object')
                throw new Error(`Master object ${driver.filename}.${this.getCredentialApply} did not return valid credentials for ${filename}`);

            if (result.UserId in this.credentials)
                return this.credentials[result.UserId];

            if (!Array.isArray(result.Groups))
                result.Groups = [];

            for (const [gid, group] of Object.entries(this.groups)) {
                if (group.isMember(result.UserId, filename)) {
                    result.Groups.push(gid);
                }
            }
            if (this.defaultGroupName)
                result.Groups.push(this.defaultGroupName);

            for (let i = 0; i < result.Groups.length; i++) {
                result.Groups[i] = this.resolveGroup(result.Groups[i]);
            }
            return (this.credentials[result.UserId] = new AclSecurityCredential(this, result));
        }, __filename, true, true);
    }

    /**
     * Parse permission string
     * @param {string} perms
     */
    parsePerms(perms) {
        if (typeof perms !== 'number' && typeof perms !== 'string')
            return 0;

        let result = 0,
            parts = typeof perms === 'string' ? perms.split('').sort() : [];

        if (typeof perms === 'number') {
            return perms;
        }
        else if (perms in this.permSets) {
            return this.permSets[perms];
        }

        parts.forEach(p => {
            switch (p) {
                case 'c': result |= SecurityFlags.P_CREATEFILE; break;
                case 'C': result |= SecurityFlags.P_CREATEFILE | SecurityFlags.P_CREATEDIR; break;
                case 'd': result |= SecurityFlags.P_DELETE; break;
                case 'D': result |= SecurityFlags.P_DELETEDIR | SecurityFlags.P_DELETE; break;
                case 'm': result |= SecurityFlags.P_READMETADATA; break;
                case 'M': result |= SecurityFlags.P_READMETADATA | SecurityFlags.P_WRITEMETADATA; break;
                case 'O': result |= SecurityFlags.P_TAKEOWNERSHIP; break;
                case 'P': result |= SecurityFlags.P_CHANGEPERMS; break;
                case 'r': result |= SecurityFlags.P_READ | SecurityFlags.P_READPERMS; break;
                case 'R': result |= SecurityFlags.P_LISTDIR | SecurityFlags.P_READ | SecurityFlags.P_READPERMS; break;
                case 'w': result |= SecurityFlags.P_WRITE; break;
                case 'x': result |= SecurityFlags.P_EXECUTE; break;
            }
        });

        //  Infinitely small performance gain
        this.permSets[parts.join('')] = result;

        return result;
    }

    /**
     * Read raw data from the specified ACL file
     * @param {string} filename
     * @returns {Promise<SecurityAcl>}
     */
    async readAclData(filename) {
        let fso = await driver.fileManager.getFileAsync(filename, 0, true);
        if (fso.exists)
            return await fso.readJsonAsync();
        else
            return {};
    }

    resolveGroup(groupName) {
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

module.exports = { AclSecurityManager };
