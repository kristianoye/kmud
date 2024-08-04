const { SecurityError } = require('../ErrorTypes');

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
    { ExecutionContext, CallOrigin } = require('../ExecutionContext'),
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
     * @param {ExecutionContext} ecc The current call stack
     * @param {boolean} flags
     * @param {string} fullPath
     * @param {string} methodName The name of the requesting method
     */
    async can(ecc, flags, fullPath, methodName = 'unknown') {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'can', callType: CallOrigin.Driver });
        try {
            let perms = await this.getEffectivePermissions(frame.branch()),
                checkCache = {};

            //  Silently inject wildcard perms
            securityManager.applyWildcardAcls(frame.branch(), perms);

            let result = await frame.context.guarded(async f => {
                //  Prevent duplicate security checks using the same criteria
                let cacheId = f.object?.objectId ?? f.file,
                    isCached = cacheId in checkCache;

                if (isCached)
                    return true;

                if (f.object) {
                    /** @type {{ userId: string, groups: string[] }} */
                    let $creds = f.object.$credential;

                    if (!$creds) // Crash?
                        throw new SecurityError(`Destructed object ${f.object.fullPath} was denied access to ${methodName} [line ${f.lineNumber}]`);

                    //  Owner always succeeds
                    if (this.owner === $creds.userId)
                        return (checkCache[cacheId] = true);

                    //  System group always succeeds
                    if (securityManager.systemGroupName && $creds.groups.indexOf(securityManager.systemGroupName) > -1)
                        return (checkCache[cacheId] = true);

                    //  Calculate effective permissions
                    let ep = 0;
                    for (const [id, data] of Object.entries(perms)) {
                        if ($creds.groups.indexOf(id) > -1)
                            ep |= data.perms;
                    }
                    if ((flags & ep) === flags)
                        return (checkCache[cacheId] = true);

                    switch (flags) {
                        case SecurityFlags.P_READ:
                            if (await driver.callApplyAsync(frame.branch(), driver.applyValidRead, fullPath, f.object, methodName)) {
                                return (checkCache[cacheId] = true);
                            }
                            break;
                        case SecurityFlags.P_WRITE:
                            if (await driver.callApplyAsync(frame.branch(), driver.applyValidWrite, fullPath, f.object, methodName)) {
                                return (checkCache[cacheId] = true);
                            }
                            break;
                    }
                }
                //  External sources (driver, node modules, etc) are whitelisted by the stack check
                else if (ExecutionContext.isExternalPath(frame.file)) {
                    return (checkCache[cacheId] = true);
                }
                else {
                    //  THIS IS A CRASH CONDITION
                    await driver.crashAsync(new Error('Encountered execution frame with no file or object parameter'));
                }
                if (f.object)
                    throw new SecurityError(`Object ${f.object.fullPath}.${f.method}() was denied access to ${methodName} [line ${f.lineNumber}]`);
                else
                    throw new SecurityError(`File ${f.object.fullPath} [method ${f.method}] was denied access to ${methodName} [line ${f.lineNumber}]`);
            }, undefined, true);

            return result;
        }
        finally {
            frame.pop();
        }
        return false;
    }

    /**
     * Get a file-specific ACL
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} name The name of the file for which we want an ACL
     * @returns {Promise<SecurityAcl> | false}
     */
    async getChildAsync(ecc, name) {
        let frame = ecc.pushFrameObject({ file: __filename, method: '', isAsync: true, callType: CallOrigin.Driver });
        try {
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
        finally {
            frame.pop();
        }
    }

    /**
     * Get the effective permissions
     * @param {ExecutionContext} ecc The current call stack
     * @param {Object.<string,AclEffectivePermission} result The object to populate with permissions
     * @returns {Object.<string,AclEffectivePermission}
     */
    async getEffectivePermissions(ecc, result = {}) {
        let frame = ecc.pushFrameObject({ file: __filename, method: '', isAsync: true, callType: CallOrigin.Driver });
        try {
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
                await this.#parent.getEffectivePermissions(frame.branch(), result);

            return result;
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current call stack
     * @param {any} tp
     * @param {any} fullPath
     * @returns
     */
    async getPermString(ecc, tp, fullPath) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getPermString', isAsync: true, callType: CallOrigin.Driver });
        try {
            let perms = await this.getEffectivePermissions(frame.branch()),
                result = 0;

            //  Silently inject wildcard perms
            securityManager.applyWildcardAcls(frame.branch(), perms);

            /** @type {{ userId: string, groups: string[] }} */
            let $creds = tp.$credential;

            //  Owner always succeeds
            if (this.owner === $creds.userId)
                result = SecurityFlags.P_ALL;

            //  System group always succeeds
            else if (securityManager.systemGroupName && $creds.groups.indexOf(securityManager.systemGroupName) > -1)
                result = SecurityFlags.P_ALL;
            else {
                //  Calculate effective permissions
                for (const [id, data] of Object.entries(perms)) {
                    if ($creds.groups.indexOf(id) > -1)
                        result |= data.perms;
                }
                if (await driver.callApplyAsync(frame.branch(), driver.applyValidRead, fullPath, tp, 'getPermString')) {
                    result |= SecurityFlags.P_READ;
                }
                if (await driver.callApplyAsync(frame.branch(), driver.applyValidWrite, fullPath, tp, 'getPermString')) {
                    result |= SecurityFlags.P_WRITE;
                }
            }
            let stringResult = SecurityFlags.permsString(result);
            return stringResult;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Save the ACL data to file
     * @param {ExecutionContext} ecc The current call stack
     */
    async saveAsync(ecc) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'saveAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (this.#children === false) {
                await this.#parent.saveAsync(frame.branch());
            }
            else {
                let aclFile = await driver.fileManager.getObjectAsync(frame.branch(), this.filename, 0, true);
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

                await aclFile.writeJsonAsync(frame.branch(), {
                    children: exportChildren(),
                    filename: this.filename,
                    inherits: this.inherits,
                    metdata: this.#metadata,
                    owner: this.owner,
                    permissions: this.#permissions,
                });
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Set ACL permissions
     * @param {ExecutionContext} ecc The current call stack
     * @param {SecurityAcl} perms
     * @param {string} [filename]
     */
    async setPermissionsAsync(ecc, perms, filename = false) {
        let frame = ecc.pushFrameObject({ file: __filename, method: '', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (await this.can(frame.branch(), SecurityFlags.P_CHANGEPERMS)) {
                /** @type {SecurityAcl} */
                let aclToModify = filename ? await this.getChildAsync(frame.branch(), filename) : this;

                aclToModify.#permissions = perms.permissions;
                if (typeof perms.inherits === 'boolean')
                    aclToModify.#inherits = perms.inherits;

                await aclToModify.saveAsync(frame.branch());

                return true;
            }
            return false;
        }
        finally {
            frame.pop();
        }
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
        this.pattern = driver.efuns.buildFilenamePattern(undefined, aclInfo.directory, false);
        this.description = aclInfo.data.description || '[No Description]';
        this.permissions = {};

        for (let group of aclInfo.data.permissions) {
            for (let [key, value] of Object.entries(group)) {
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
        this.initialized = false;
    }

    /**
     * Add a member to a group
     * @param {ExecutionContext} ecc The current call stack
     * @param {AclSecurityGroup} group
     * @param {string[] | AclSecurityCredential[]} members
     */
    async addGroupMembers(ecc, group, members) {
        let frame = ecc.pushFrameObject({ file: __filename, method: '', isAsync: true, callType: CallOrigin.Driver });
        try {
        }
        finally {
            frame.pop();
        }
        if (group.gid in this.groups) {
            if (this.initialized && typeof memberId === 'string')
                memberId = this.getCredential(memberId);

            for (const member of members) {
                if (this.initialized && typeof member === 'string')
                    member = this.getCredential(member);
                group.addMember(member);
                if (member instanceof AclSecurityCredential)
                    member.addGroup(group);
                else if (member instanceof AclSecurityGroup) {
                    for (const m of member.members) {
                        if (m instanceof AclSecurityCredential)
                            m.addGroup(group);
                    }
                }
            }
            return await this.saveGroups();
        }
        else
            throw new Error(`addGroupMember(): ${group.gid} is not a registered group`);
    }

    /**
     * Remove members from a group
     * @param {ExecutionContext} ecc The current call stack
     * @param {AclSecurityGroup} group
     * @param {(AclSecurityCredential | AclSecurityGroup)[]} members
     * @returns
     */
    async removeGroupMembers(ecc, group, members) {
        let frame = ecc.pushFrameObject({ file: __filename, method: '', isAsync: true, callType: CallOrigin.Driver });
        try {
        }
        finally {
            frame.pop();
        }
        if (group.gid in this.groups) {
            if (this.initialized && typeof memberId === 'string')
                memberId = this.getCredential(memberId);

            for (const member of members) {
                if (this.initialized && typeof member === 'string')
                    member = this.getCredential(member);

                group.removeMember(member);
            }
            return await this.saveGroups();
        }
        else
            throw new Error(`removeGroupMembers(): ${group.gid} is not a registered group`);
    }

    /**
     * Apply wildcard ACLs
     * @param {ExecutionContext} ecc The current call stack
     * @param {SecurityAcl} acl
     */
    applyWildcardAcls(ecc, acl) {
        let frame = ecc.pushFrameObject({ file: __filename, method: '', isAsync: true, callType: CallOrigin.Driver });
        try {
        }
        finally {
            frame.pop();
        }
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
     * @param {ExecutionContext} ecc The current call stack
     * @param {GameServer} masterObject
     */
    async bootstrap(ecc, masterObject) {
        let frame = ecc.pushFrameObject({ object: this, file: __filename, method: 'bootstrap', callType: CallOrigin.Driver });
        try {
            if (this.bootstrapApply) {
                await super.bootstrap(masterObject);
            }
            if (!this.groupsFile)
                throw new Error('bootstrap() security module requires groups file');
            if (!this.permissionsFile)
                throw new Error('bootstrap() security module requires permissions file');

            await this.loadGroupsFile(frame.branch());
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Cache an ACL
     * @param {string} path
     * @param {SecurityAcl} acl
     */
    cacheAcl(path, acl) {
        this.aclCache[path] = acl;
        return acl;
    }

    /**
     * Check to see if the type of action is allowed in the current context.
     * @param {ExecutionContext} ecc The current call stack
     * @param {FileSystemObject} fo
     * @param {number} flags The flags describing the desired I/O operation
     * @param {string} methodName The name of the method making the request
     */
    async can(ecc, fo, flags, methodName = 'unknonwn') {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'can', isAsync: true });
        try {
            //  Everything is read-write until the master object is loaded
            if (!driver.masterObject)
                return true;

            let acl = await this.getAcl(frame.branch(), fo);
            let result = await acl.can(frame.branch(), flags, fo.fullPath, methodName);
            return result;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Create a new security group
     * @param {ExecutionContext} ecc The current call stack
     * @param {any} group
     * @returns
     */
    async createGroup(ecc, group) {
        let frame = ecc.pushFrameObject({ file: __filename, method: '', isAsync: true, callType: CallOrigin.Driver });
        try {
        }
        finally {
            frame.pop();
        }
        if (group.id in this.groups)
            throw new Error(`createGroup(): Security group ${group.id} already exists`);
        let newGroup = this.groups[group.id] = new AclSecurityGroup(this, group.id, group.name, group.description, group.members || []);
        for (const id of newGroup.members) {

        }
        return this.saveGroups();
    }

    /**
     * Delete an existing security group
     * @param {ExecutionContext} ecc The current call stack
     * @param {any} group
     * @returns
     */
    async deleteGroup(ecc, group) {
        let frame = ecc.pushFrameObject({ file: __filename, method: '', isAsync: true, callType: CallOrigin.Driver });
        try {
        }
        finally {
            frame.pop();
        }
        if (group.id in this.groups === false)
            throw new Error(`deleteGroup(): Security group ${group.id} does not exist`);
        delete this.groups[group.id];
        return this.saveGroups();
    }

    /**
     * Get the Access Control List for the specified object.
     * @param {ExecutionContext} ecc The current call stack
     * @param {FileSystemObject|string} fo The stat to get an Acl for
     * @returns {Promise<SecurityAcl>}
     */
    async getAcl(ecc, fo, ignoreParent = false) {
        let frame = ecc.pushFrameObject({ file: __filename, method: '', isAsync: true, callType: CallOrigin.Driver });
        if (typeof fo === 'string') {
            try {
                return await this.getAcl(frame.branch(), await driver.fileManager.getObjectAsync(frame.branch(), fo, 0, true));
            }
            finally {
                frame.pop();
            }
        }
        else
            return new Promise(async (resolve, reject) => {
                try {
                    if (fo.isFile) {
                        let parent = await fo.getParentAsync(frame.branch()),
                            parentAcl = await this.getAcl(frame.branch(), parent);

                        return resolve(await parentAcl.getChildAsync(frame.branch(), fo.name));
                    }
                    else if (fo.isDirectory) {
                        try {
                            if (fo.path in this.aclCache)
                                return resolve(this.aclCache[fo.path]);
                            let aclFilename = await this.getAclFilename(frame.branch(), fo);
                            let aclFile = await driver.fileManager.getObjectAsync(frame.branch(), aclFilename, 0, true);
                            let existingData = aclFile.exists ? await this.readAclData(frame.branch(), aclFilename) : false;
                            let parentAcl = fo.parent ? await this.getAcl(frame.branch(), fo.parent) : false;
                            let requireSave = !aclFile.exists;

                            //  There was no data for this directory; Ask the master
                            if (existingData === false) {
                                existingData = await driver.callApplyAsync(frame.branch(), this.createAclApply, fo.fullPath);
                            }

                            if (!existingData.owner)
                                existingData.owner = await driver.callApplySync(frame.branch(), this.getFileOwnerApply, fo.fullPath, fo.isDirectory);

                            /** @type {SecurityAcl} */
                            let acl = new SecurityAcl(parentAcl, true, aclFile.fullPath, existingData);

                            if (requireSave)
                                await acl.saveAsync(frame.branch());

                            return resolve(this.cacheAcl(fo.path, acl));
                        }
                        catch (err) {
                            reject(err);
                        }
                    }
                    else if (!fo.exists && ignoreParent === false) {
                        //  Look for the first parent that does exist
                        let parent = await fo.getParentAsync(frame.branch());

                        if (!parent.exists) {
                            do {
                                parent = await parent.getParentAsync(frame.branch());
                            }
                            while (!parent.exists);
                        }

                        let parentAcl = await this.getAcl(parent);

                        return resolve(await parentAcl.getChildAsync(frame.branch(), fo.name));
                    }
                    else
                        reject(`Invalid request:`)
                }
                finally {
                    frame.pop();
                }
            });
    }

    /**
     * Get the filename of the ACL file for the provided object
     * @param {ExecutionContext} ecc The current call stack
     * @param {FileSystemObject} fso
     * @returns string The full MUD path of the ACL file
     */
    async getAclFilename(ecc, fso) {
        let frame = ecc.pushFrameObject({ file: __filename, method: '', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (this.shadowFilesystem) {
                const aclPath = fso.isDirectory ?
                    path.join(this.shadowFilesystem, fso.fullPath.slice(1)) :
                    path.join(this.shadowFilesystem, fso.directory.slice(1));
                let aclDir = await driver.fileManager.getObjectAsync(frame.branch(), aclPath, 0, true);

                if (!aclDir.exists) {
                    await aclDir.createDirectoryAsync(frame.branch(), true);
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
        finally {
            frame.pop();
        }
    }

    /**
     * Fetch a particular group
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} groupName
     */
    getGroup(ecc, groupName) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getGroup', isAsync: true, callType: CallOrigin.Driver });
        try {
            return this.groups[groupName];
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Get a MUD-safe representation of a security credential
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} username
     */
    async getSafeCredentialAsync(ecc, username) {
        let frame = ecc.pushFrameObject({ file: __filename, method: '', isAsync: true, callType: CallOrigin.Driver });
        try {
            let creds = await this.getCredential(frame.branch(), username);
            return creds.createSafeExport(frame.branch());
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Initialize permissions on the filesystem
     * @param {ExecutionContext} ecc The current call stack
     */
    async initSecurityAsync(ecc) {
        let frame = ecc.pushFrameObject({ method: 'initSecurityAsync', isAsync: true });
        try {
            if (this.shadowFilesystem !== false) {
                let shadowFS = await driver.fileManager.getFileAsync(ecc.branch(), this.shadowFilesystem, 0, true);
                if (!shadowFS.exists) {
                    console.log(`Creating shadow volumne: ${shadowFS.fullPath}`);
                    await shadowFS.createDirectoryAsync(true);
                }
            }
            this.initialized = true;
            for (const group of Object.values(this.groups)) {
                group.resolveMembers(ecc.branch());
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Check to see if the specified user is a member of a particular group
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} userId
     * @param {string} groupName
     */
    isGroupMember(ecc, userId, groupName) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'isGroupMember', isAsync: false, callType: CallOrigin.Driver });
        try {
            let group = this.getGroup(frame.context, groupName);
            return group && group.isMember(frame.context, userId);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Is the file a system file?
     * @param {ExecutionContext} ecc The current call stack
     * @param {FileSystemObject} file
     */
    isSystemFile(ecc, file) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'isSystemFile', isAsync: false, callType: CallOrigin.Driver });
        try {
            if (file.fullPath === this.groupsFile) return true;
            else if (file.fullPath === this.permissionFile) return true;
            else if (file.name === this.aclFileName) return true;
            else return super.isSystemFile(ecc.branch(), file);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current call stack
     * @param {any} expr
     * @returns
     */
    listGroups(ecc, expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'listGroups', isAsync: false, callType: CallOrigin.Driver });
        try {
            if (!expr) expr = '*';
            expr = expr.replace('*', '.*');
            expr = expr.replace('?', '.');
            expr = expr.replace('$', '\\$');
            try {
                let re = new RegExp(expr, 'i');
                let results = [];

                for (const [id, group] of Object.entries(this.groups)) {
                    if (re.test(id))
                        results.push(group.createSafeExport(frame.branch()));
                }
                return results;
            }
            catch (e) {
                return [];
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Load groups defined in the system groups file
     * @param {ExecutionContext} ecc The current call stack
     */
    async loadGroupsFile(ecc) {
        let frame = ecc.pushFrameObject({ object: this, file: __filename, method: 'loadGroupsFile', isAsync: true });
        try {
            let groupsFile = await driver.fileManager.getObjectAsync(frame.branch(), this.groupsFile, 0, true),
                groupData = await groupsFile.readJsonAsync(frame.branch());

            this.defaultGroupName = groupData.defaultGroupName || '$ALL';
            this.systemGroupName = groupData.systemGroupName || '$SYSTEM';

            for (const [id, data] of Object.entries(groupData.groups)) {
                if (id in this.groups)
                    throw new Error(`Group ${id} is specified multiple times in ${this.groupsFile}`);

                if (!data.name || typeof data.name !== 'string')
                    throw new Error(`Group #${id} in ${this.groupsFile} does not have a property 'name'`);

                if (data.members && !Array.isArray(data.members))
                    throw new Error(`Group ${id} does not have a valid member collection`);

                this.groups[id] = new AclSecurityGroup(this, id, data.name, data.description || '[No description]', data.members);
            }
            if (this.defaultGroupName in this.groups === false) {
                this.groups[this.defaultGroupName] = new AclSecurityGroup(this, this.defaultGroupName, 'Default Group', 'Default group that all objects are members of', []);
            }
        }
        finally {
            frame.pop();
        }
    }

    /** 
     * Load initial ACL information
     * @param {ExecutionContext} ecc The current call stack
     */
    async loadPermissionsFile(ecc) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'loadPermissionsFile', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let perms = await efuns.fs.readYamlAsync(frame.branch(), this.permissionsFile),
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
                    if (driver.efuns.containsWildcard(frame.branch(), aclData.directory)) {
                        this.wildcardPermissions.push(new WildcardAcl(dirList[i]));
                        continue;
                    }
                    /** @type {FileSystemObject} */
                    let fso = await driver.fileManager.getObjectAsync(frame.branch(), aclData.directory || aclData.file, 0, true);

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

                            let aclFile = await driver.fileManager.getObjectAsync(frame.branch(), this.aclFileName, 0, true), // await fso.getFileAsync(this.aclFileName),
                                existingData = await this.readAclData(frame.branch(), await this.getAclFilename(frame.branch(), aclFile)),
                                parentAcl = fso.parent ? await this.getAcl(frame.branch(), fso.parent) : false;

                            /** @type {AclDirectoryData} */
                            let data = Object.assign(existingData, aclData.data);

                            if (!data.owner)
                                data.owner = await driver.callApplyAsync(frame.branch(), this.getFileOwnerApply, fso.fullPath);

                            /** @type {SecurityAcl} */
                            let acl = this.cacheAcl(fso.fullPath, new SecurityAcl(parentAcl, true, aclFile.fullPath, data));

                            await acl.saveAsync(frame.branch());
                        }
                        else
                            console.log(`\tWARNING: Skipping permissions for missing directory: ${fso.path}`);
                    }
                    else {
                        let parentAcl = await this.getAcl(frame.branch(), await fso.getParentAsync(frame.branch()));
                        console.log(`\tEnsuring permissions for file: ${aclData.file}`);
                        await parentAcl.setPermissionsAsync(frame.branch(), aclData.data, fso.name);

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
        finally {
            frame.pop();
        }
    }

    /**
     * Get a credential
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} filename
     * @returns {AclSecurityCredential | AclSecurityGroup}
     */
    getCredential(ecc, filename, reload = false) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getCredential', callType: CallOrigin.Driver });
        try {
            if ('~@$'.indexOf(filename.charAt(0)) > -1) {
                return this.groups[filename];
            }
            /** @type {{ IsUser: boolean, UserId: string, IsWizard: boolean, Groups: string[]}} */
            let result;

            if (filename.indexOf('\\') > -1)
                result = { UserId: filename };
            else
                result = driver.masterObject[this.getCredentialApply](ecc.branch(), filename);

            if (!result || typeof result !== 'object')
                throw new Error(`Master object ${driver.filename}.${this.getCredentialApply} did not return valid credentials for ${filename}`);

            if (result.UserId in this.credentials && reload === false)
                return this.credentials[result.UserId];

            if (!Array.isArray(result.Groups))
                result.Groups = [];

            for (const [gid, group] of Object.entries(this.groups)) {
                if (group.isMember(frame.branch(), result.UserId, filename)) {
                    result.Groups.push(gid);
                }
            }
            if (this.defaultGroupName)
                result.Groups.push(this.defaultGroupName);

            for (let i = 0; i < result.Groups.length; i++) {
                result.Groups[i] = this.resolveGroup(frame.branch(), result.Groups[i]);
            }
            return (this.credentials[result.UserId] = new AclSecurityCredential(this, result));
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Get multiple credentials at once
     * @param {ExecutionContext} ecc The current call stack
     * @param {string[]} names
     * @returns {AclSecurityCredential[] | string[]}
     */
    getCredentials(ecc, names) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getCredentials', isAsync: true, callType: CallOrigin.Driver });
        try {
            let frame = ecc.pushFrameObject({ method: 'getCredentials' });
            try {
                return this.initialized ? names.map(n => this.getCredential(ecc.branch(), n)) : names;
            }
            finally {
                frame.pop();
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current call stack
     * @param {any} fo
     * @returns
     */
    async getGroupName(ecc, fo) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getGroupName', isAsync: true, callType: CallOrigin.Driver });
        try {
            let acl = await this.getAcl(frame.branch(), fo);
            return acl && acl.group || '(no group)';
        }
        finally {
            frame.pop();
        }
    }


    /**
     * Retrieve the owner name of a particular file
     * @param {ExecutionContext} ecc The current call stack
     * @param {FileSystemObject} fo The file object to retreve ownership info for
     * @returns {string} Returns the name of the file owner
     */
    async getOwnerName(ecc, fo) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getOwnerName', isAsync: true, callType: CallOrigin.Driver });
        try {
        }
        finally {
            frame.pop();
        }
        let acl = await this.getAcl(fo);
        return acl ? acl.owner : 'unknown';
    }

    /**
     * Get a string representing the specified player's access
     * @param {ExecutionContext} ecc The current call stack
     * @param {object} fo
     * @param {any} tp
     * @returns {string} Returns a string indicating individual permissions
     */
    async getPermString(ecc, fo, tp) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getPermString', isAsync: true, callType: CallOrigin.Driver });
        try {
        }
        finally {
            frame.pop();
        }
        let acl = await this.getAcl(fo);
        return acl ? acl.getPermString(tp, fo.fullPath) : 'unknown';
    }

    /**
     * Parse permission string
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} perms
     */
    parsePerms() {
        /** @type {[ ExecutionContext, string ]} */
        let [frame, perms] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'parsePerms' });
        try {
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
                    case 'p': result |= SecurityFlags.P_READPERMS; break;
                    case 'r': result |= SecurityFlags.P_READ | SecurityFlags.P_READPERMS; break;
                    case 'R': result |= SecurityFlags.P_LISTDIR | SecurityFlags.P_READ | SecurityFlags.P_READPERMS; break;
                    case 'w': result |= SecurityFlags.P_WRITE; break;
                    case 'x': result |= SecurityFlags.P_EXECUTE; break;
                    case 'L': result |= SecurityFlags.P_LOADOBJECT; break;
                    case 'U': result |= SecurityFlags.P_DESTRUCTOBJECT; break;
                }
            });

            //  Infinitely small performance gain
            this.permSets[parts.join('')] = result;

            return result;
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Read raw data from the specified ACL file
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} filename
     * @returns {Promise<SecurityAcl>}
     */
    async readAclData(ecc, filename) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'readAclData', isAsync: true, callType: CallOrigin.Driver });
        try {
            let fso = await driver.fileManager.getObjectAsync(frame.branch(), filename, 0, true);
            if (fso.exists)
                return await fso.readJsonAsync(frame.branch());
            else
                return {};
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current call stack
     * @param {any} groupName
     * @returns
     */
    resolveGroup(ecc, groupName) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'resolveGroup', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (groupName in this.groups)
                return this.groups[groupName];
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Save the groups file
     * @param {ExecutionContext} ecc The current call stack
     * @returns {Promise<boolean>}
     */
    async saveGroups(ecc) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'saveGroups', isAsync: true, callType: CallOrigin.Driver });
        try {
            let groupData = {
                defaultGroupName: this.defaultGroupName,
                systemGroupName: this.systemGroupName,
                groups: {}
            };
            for (const [id, group] of Object.entries(this.groups)) {
                groupData.groups[id] = group.createSafeExport(frame.branch());
            }
            let groupsFile = await driver.fileManager.getFileAsync(frame.branch(), this.groupsFile, 0, true);
            return await groupsFile.writeJsonAsync(frame.branch(), groupData);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Convert bitflags to a permission string
     * @param {number} flags
     */
    toPermString(flags) {
        return SecurityFlags.permsString(flags);
    }

    /**
     * Ensure the master object is compatible with this security manager.
     * @param {ExecutionContext} ecc The current call stack
     * @param {GameServer} gameDriver
     */
    async validateAsync(ecc, gameDriver) {
        let frame = ecc.pushFrameObject({ method: 'validateAsync', file: __filename, isAsync: true, callType: CallOrigin.Driver });
        try {
            if (typeof gameDriver.masterObject[this.getCredentialApply] !== 'function')
                throw new Error(`Master object ${driver.masterObject.filename} does not contain method '${this.getCredentialApply}'`);
            if (typeof gameDriver.masterObject[this.createAclApply] !== 'function')
                throw new Error(`Master object ${driver.masterObject.filename} does not contain method '${this.createAclApply}'`);
            await this.loadPermissionsFile(ecc.branch());
        }
        finally {
            frame.pop();
        }
    }

    /**
      * Check to see if the caller may append to file.
      * @param {ExecutionContext} ecc The current call stack
      * @param {EFUNProxy} efuns
      * @param {FileSystemRequest} req
      */
    validAppendFile(ecc, efuns, req) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validAppendFile', isAsync: true, callType: CallOrigin.Driver });
        try {
            return this.validWriteFile(frame.branch(), efuns, req);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determine whether the caller is allowed to create a directory.
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The directory being created.
     */
    validCreateDirectory(ecc, expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validCreateDirectory', isAsync: true, callType: CallOrigin.Driver });
        try {
            return this.validWriteFile(frame.branch(), expr);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Default security does not distinguish creating a file from writing.
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The expression to create
     */
    validCreateFile(ecc, expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validCreateFile', isAsync: true, callType: CallOrigin.Driver });
        try {
            return this.validWriteFile(frame.branch(), expr);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determine if the caller is permitted to remove a particular directory.
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The directory to delete
     */
    validDeleteDirectory(ecc, expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validDeleteDirectory', isAsync: true, callType: CallOrigin.Driver });
        try {
            return this.validWriteFile(frame.branch(), expr);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Default security does not distinguish deleting a file from writing.
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The path to delete
     */
    validDeleteFile(ecc, expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validDeleteFile', isAsync: true, callType: CallOrigin.Driver });
        try {
            return this.validWriteFile(frame.branch(), expr);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Default security does not restrict object destruction.
     * @param {ExecutionContext} ecc The current call stack
     * @param {FileSystemRequest} expr
     */
    validDestruct(ecc, expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validDestruct', isAsync: true, callType: CallOrigin.Driver });
        try {
            return true;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determine if the user has access to the specified directory.
     * @param {ExecutionContext} ecc The current call stack
     * @param {any} expr
     */
    validGetDirectory(ecc, expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validGetDirectory', isAsync: true, callType: CallOrigin.Driver });
        try {
            return true;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Default security system does not support granting permissions.
     * @param {ExecutionContext} ecc The current call stack
     */
    validGrant(ecc, expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validGrant', isAsync: true, callType: CallOrigin.Driver });
        try {
            throw new Error('Security system does not support the use of grant');
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Default security does not enforce object loading or cloning.
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The path to load the object from.
     */
    validLoadObject(ecc, expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validLoadObject', isAsync: true, callType: CallOrigin.Driver });
        try {
            return this.validReadFile(frame.branch(), expr);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Default security does not distinguish between file and directory reads.
     * @param {ExecutionContext} ecc The current call stack
     * @param {EFUNProxy} efuns The proxy requesting the directory listing.
     * @param {FileSystemRequest} req The path expression to try and read.
     */
    async validReadDirectory(ecc, req) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validReadDirectory', isAsync: true, callType: CallOrigin.Driver });
        try {
            return await this.validReadFile(frame.branch(), req);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Perform a security check
     * @param {ExecutionContext} ecc The current call stack
     * @param {DirectoryObject} stat The stat object to check
     */
    async validReadDirectoryAsync(ecc, stat) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validReadDirectoryAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (!stat.isDirectory)
                throw new Error(`Bad argument 1 to validReadDirectoryAsync; Expected DirectoryObject got ${stat.constructor.name}`);
            return true; // BOGUS... but does not work yet
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determine if the caller has permission to read a particular file.
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} filename The file to read from
     * @returns {boolean} True if the operation can proceed.
     */
    async validReadFile(ecc, filename) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validReadFile', isAsync: true, callType: CallOrigin.Driver });
        try {
            return frame.context.guarded(async f => await driver.validRead(frame.branch(), f, filename));
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Default security treats filestat as a normal read operation.
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} filename The name of the file to stat
     * @returns {boolean} True if the operation can proceed.
     */
    validStatFile(ecc, filename) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validStatFile', isAsync: true, callType: CallOrigin.Driver });
        try {
            return this.validReadFile(frame.branch(), filename);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Determine if the caller has permission to write to the filesystem.
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The path to write to
     * @returns {boolean} Returns true if the operation is permitted.
     */
    validWriteFile(ecc, expr) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'validWriteFile', isAsync: true, callType: CallOrigin.Driver });
        try {
            return frame.context.guarded(f => driver.validWrite(frame.branch(), f, expr));
        }
        finally {
            frame.pop();
        }
    }
}

module.exports = { AclSecurityManager };
