/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides granular file security.
 */

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
                let content = await driver.fileManager.readJsonFileAsync(filename);
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

module.exports = FileACL;
