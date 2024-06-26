/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    { EventEmitter } = require('events'),
    { NotImplementedError, SecurityError } = require('../ErrorTypes');

class BaseSecurityManager extends EventEmitter {
    /**
     * Construct a file security model that acts as a firewall
     * between mudlib and filesystem.
     * @param {FileManager} fileManager A reference to the file manager.
     * @param {Object.<string,any>} options
     */
    constructor(fileManager, options) {
        super();

        /**
         * The name of the method to call in the master object when bootstrapping
         * the security manager.
         * @type {string} */
        this.bootstrapApply = options.bootstrapApply;

        /** @type {GameServer} */
        this.driver = fileManager.driver;

        /** @type {FileManager} */
        this.fileManager = fileManager;

        /** @type  {Object.<string,any>} */
        this.options = options || {};

        /** @type {boolean} */
        this.throwSecurityExceptions = this.options.throwSecurityExceptions || false;
    }

    async bootstrap(masterObject) {
        if (this.bootstrapApply) {
            if (typeof masterObject[this.bootstrapApply] !== 'function') {
                throw new Error(`BaseFileSecurity.bootstrap(): Failed to locate apply '${this.bootstrapApply}' in master object '${masterObject.filename}'`);
            }
            return masterObject[this.bootstrapApply](this);
        }
    }

    async can(flags) {
        throw new NotImplementedError('Method can() is not defined');
    }

    async createGroup(group) {
        throw new NotImplementedError('Method createGroup() is not defined');
    }

    /**
     * Generate a security error or just indicate failure quietly.
     * @param {string} verb The verb being denied (e.g. read, write, append, etc).
     * @param {FileSystemRequest} req The request being made.
     * @param {function(boolean,Error):void} callback An optional callback 
     * @returns {false} This always returns false
     */
    denied(verb, req, callback) {
        let err = undefined;
        if (typeof verb === 'object') {
            req = verb;
            err = new SecurityError(`Permission denied: Could not ${req.op} '${req.fullPath}'`);
        }
        else
            err = new SecurityError(`Permission denied: Could not ${verb} '${(req.fullPath || req)}'`);

        if (this.throwSecurityExceptions)
            throw err;

        return typeof callback === 'function' ?
            callback(false, err) :
            false;
    }

    /**
     * 
     * @param {string} username
     */
    getSafeCredentialAsync(username) {
        throw new NotImplementedError('getSafeCredential');
    }

    initSecurityAsync() {
        throw new NotImplementedError('initSecurityAsync');
    }

    isSystemFile(path) {
        return false;
    }

    isValidGroupId(id) {
        if (typeof id === 'string') {
            return ['~', '^', '$'].indexOf(id.charAt(0)) > -1;
        }
        return false;
    }

    async getGroupName(fo) {
        throw new NotImplementedError('getGroupName');
    }

    /**
     * Retrieve the owner name of a particular file
     * @param {object} fo The file object to retreve ownership info for
     * @returns {string} Returns the name of the file owner
     */
    async getOwnerName(fo) {
        throw new NotImplementedError('getOwnerName');
    }

    /**
     * Get a string representing the specified player's access
     * @param {object} fo
     * @param {any} tp
     * @returns {string} Returns a string indicating individual permissions
     */
    async getPermString(fo, tp) {
        throw new NotImplementedError('getPermString');
    }

    // #region Security valid* Applies

    /**
     * Check to see if the caller may append to file.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validAppendFile(efuns, req) {
        throw new NotImplementedError('validAppendFile');
    }


    /**
     * Check to see if the caller may create a directory.
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validCreateDirectory(efuns, req) {
        throw new NotImplementedError('validCreateDirectory');
    }

    /**
     *
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validCreateFile(efuns, req) {
        throw new NotImplementedError('validCreateFile');
    }

    /**
     *
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validDeleteFile(efuns, req) {
        throw new NotImplementedError('validDelete');
    }

    /**
     *
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validDeleteDirectory(efuns, req) {
        throw new NotImplementedError('validDeleteDirectory');
    }

    /**
     *
     * @param {EFUNProxy} efuns
     * @param {FileSystemRequest} req
     */
    validDestruct(efuns, req) {
        throw new NotImplementedError('validDestruct');
    }

    /**
     * Does the caller have the ability to modify permissions.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {FileSystemRequest} req The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
    */
    validGrant(efuns, req) {
        throw new NotImplementedError('validGrant');
    }

    /**
     * Default security does not enforce object loading or cloning.
     * @param {EFUNProxy} efuns External functions making the call.
     * @param {FileSystemRequest} req The path to load the object from.
     * @returns {boolean}
     */
    validLoadObject(efuns, req) {
        throw new NotImplementedError('validLoadFile');
    }

    /**
     * Does the caller have permissions to read a directory.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {FileSystemRequest} req The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
    */
    validReadDirectory(efuns, req) {
        throw new NotImplementedError('validReadDir');
    }

    /**
     * Does the caller have permission to read a file.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {FileSystemRequest} req The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
    */
    validReadFile(efuns, req) {
        throw new NotImplementedError('validRead');
    }

    /**
     * Does the caller have permission to read file permissions.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {FileSystemRequest} req The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
    */
    validReadPermissions(efuns, req) {
        throw new NotImplementedError('validReadPermissions');
    }

    /**
     * Validate the request to stat a file.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {FileSystemRequest} req The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
     */
    validStatFile(efuns, req) {
        throw new NotImplementedError('validStatFile');
    }

    /**
     * Validate a write operation.
     * @param {EFUNProxy} efuns The caller attempting to perform the I/O
     * @param {FileSystemRequest} req The file expression to be operated on.
     * @returns {boolean} True if the operation should be permitted.
     */
    validWriteFile(efuns, req) {
        throw new NotImplementedError('validWrite');
    }

    // #endregion
}

/** Base credential */
class BaseSecurityCredential extends EventEmitter {
    /**
     * Construct a credential
     * @param {{ IsUser: boolean, UserId: string, IsWizard: boolean, Groups: BaseSecurityGroup[]}} data
     */
    constructor(data) {
        super();

        this.#groups = data.Groups || [];
        this.#userId = data.UserId;

        if (data.IsUser)
            this.IsUser = true;
        if (data.IsWizard)
            this.IsWizard = true;
    }

    /**
     * Add a group
     * @param {BaseSecurityGroup} group
     */
    addGroup(group) {
        if (group instanceof BaseSecurityGroup) {
            if (this.#groups.indexOf(group) === -1) {
                this.#groups.push(group);
                return true;
            }
        }
        return false;
    }

    createSafeExport() {
        let safeObject = {
            userId: this.userId,
            groups: this.groups.map(g => g.createSafeExport())
        };
        if (this.IsUser)
            safeObject.IsUser = true;
        if (this.IsWizard)
            safeObject.IsWizard = true;

        return Object.freeze(safeObject);
    }

    /** @type {BaseSecurityGroup[]} */
    #groups;

    /** @type {string} */
    #userId;

    get groupIds() {
        return this.#groups.map(g => g.gid);
    }

    get groupNames() {
        return this.#groups.map(g => g.name);
    }

    get groups() {
        return this.#groups.slice(0);
    }

    /**
     * Check to see if the identifier represents this credential
     * @param {string | BaseSecurityCredential} info
     */
    isEqual(info) {
        if (info instanceof BaseSecurityCredential)
            return info === this || info.userId === this.userId;
        else if (typeof info === 'string')
            return info === this.userId;
        else
            return false;
    }

    /**
     * Check to see if this credential exists
     * @param {any} groupName
     */
    inGroup(groupName) {
        return this.#groups.indexOf(groupName) > -1;
    }

    /**
     * Remove the group
     * @param {BaseSecurityGroup} group
     */
    removeFromGroup(group) {
        let index = this.#groups.findIndex(g => g.gid === group.gid);
        if (index > -1) {
            this.#groups.splice(index, 1);
            return true;
        }
        return false;
    }

    get userId() {
        return this.#userId;
    }
}

class BaseSecurityGroup extends EventEmitter {
    /**
     * Construct a security group object
     * @param {BaseSecurityManager} manager The manager object that owns this object
     * @param {string} id The group ID
     * @param {string} name The name of the group
     * @param {string} desc A description of the group role
     * @param {(string | BaseSecurityCredential | BaseSecurityGroup)[]} members
     */
    constructor(manager, id, name, desc, members = []) {
        super();
        this.#gid = id;
        this.#owner = manager;
        this.#description = desc;
        this.#members = Array.isArray(members) ? members : [];
        this.#name = name;
    }

    createSafeExport() {
        return Object.freeze({
            id: this.gid,
            name: this.name,
            description: this.description,
            members: this.members.map(m => {
                if (m instanceof BaseSecurityGroup)
                    return m.gid !== this.owner.defaultGroupName && m.gid;
                else if (m instanceof BaseSecurityCredential)
                    return m.userId;
                else if (typeof m === 'string')
                    return m;
                else
                    return false;
            }).filter(m => m !== false)
        });
    }

    /** @type {string} */
    #description;

    get description() {
        return this.#description.slice(0);
    }

    /** @type {string} */
    #gid;

    get gid() {
        return this.#gid.slice(0);
    }

    get id() {
        return this.#gid.slice(0);
    }

    isEqual(info) {
        if (info instanceof BaseSecurityGroup)
            return info === this || info.name === this.name;
        else if (typeof info === 'string')
            return info === this.name;
        else
            return false;
    }

    /** @type {(string | BaseSecurityCredential | BaseSecurityGroup)[]} */
    #members;

    get members() {
        return this.#members.slice(0);
    }

    /** @type {string} */
    #name;

    get name() {
        return this.#name.slice(0);
    }

    /** @type {BaseSecurityManager} */
    #owner;

    get owner() {
        return this.#owner;
    }

    /**
     * Attempt to add the specified object to the security group.
     * @param {string | BaseSecurityCredential | BaseSecurityGroup} member
     */
    addMember(member) {
        if (!this.isMember(member)) {
            if (member instanceof BaseSecurityGroup) {
                if (member.isMember(this)) {
                    throw new Error(`Attempted circular group reference: ${this.name} is a member of ${member.name}`);
                }
            }
            this.#members.push(member);
            if (member instanceof BaseSecurityCredential)
                member.addGroup(this);
            else if (member instanceof BaseSecurityGroup) {
                for (const m of member.members) {
                    if (m instanceof BaseSecurityCredential)
                        m.addGroup(this);
                }
            }
            return true;
        }
        return false;
    }

    /**
     * Return the group index of the specified member or -1 if not a member
     * @param {string | BaseSecurityCredential | BaseSecurityGroup} member
     */
    findIndex(member) {
        return this.#members.findIndex(m => {
            if (m instanceof BaseSecurityGroup) {
                return m.isMember(member);
            }
            else if (m instanceof BaseSecurityCredential) {
                return m === member || m.userId === member;
            }
            else if (typeof m === 'string') {
                let group = this.owner.getGroup(m);
                if (group)
                    return group.isMember(member);
                else if (member instanceof BaseSecurityGroup)
                    return member.name === m;
                else if (member instanceof BaseSecurityCredential)
                    return member.userId === m;
                else if (typeof member === 'string')
                    return member === m;
            }
            return false;
        });
    }

    /**
     * Check if the supplied argument is a member of this group
     * @param {string | BaseSecurityCredential | BaseSecurityGroup} member
     */
    isMember(member) { 
        return this.findIndex(member) > -1;
    }

    /**
     * Attempt to remove the specified object from the security group.
     * @param {string | BaseSecurityCredential | BaseSecurityGroup} member
     */
    removeMember(member) {
        //  Objects cannot be removed from default group
        if (this.gid === this.owner.defaultGroupName)
            return false;

        let index = this.findIndex(member);
        if (index > -1) {
            this.#members.splice(index, 1);
            if (member instanceof BaseSecurityCredential)
                member.removeFromGroup(this);
            else if (member instanceof BaseSecurityGroup) {
                for (const m of member.members) {
                    m.removeFromGroup(this);
                }
            }
            return true;
        }
        return false;
    }

    resolveMembers() {
        if (this.owner.initialized === true) {
            this.#members = this.owner.getCredentials(this.members);
        }
    }
}

module.exports = { BaseSecurityManager, BaseSecurityCredential, BaseSecurityGroup };
