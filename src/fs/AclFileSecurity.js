/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    BaseFileSecurity = require('./BaseFileSecurity'),
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
    P_EXECUTE = 1 << 14;

class FileAcl {
    constructor(parent) {

    }
}

class DirectoryAcl {
    constructor(stat, acl) {
        this.inherits = typeof acl.inherits === 'boolean' ? acl.inherits : true;
        this.permissions = acl.permissions || {};
        this.files = acl.files || {};
        this.path = stat.path;
    }

    /**
     * The permission to string
     * @param {string} str
     */
    static parseAclString(str) {
        let flags = 0;
        if (str === 'FULL')
            flags = P_READ | P_WRITE | P_DELETE | P_LISTDIR | P_EXECUTE |
                P_CREATEFILE | P_CREATEDIR | P_CHANGEPERMS |
                P_READPERMS | P_TAKEOWNERSHIP | P_READMETADATA |
                P_WRITEMETADATA | P_VIEWSYSTEMFILES | P_LOADOBJECT;
        else if (str === 'NONE')
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

    static toAclString(flags) {
        let bits = [
            [ P_READ, 'r' ],
            [ P_WRITE, 'w' ],
            [ P_DELETE, 'd' ],
            [ P_LISTDIR, 'L' ],
            [ P_EXECUTE, 'x' ],
            [ P_CREATEFILE, 'c' ],
            [ P_CREATEDIR, 'C' ],
            [ P_CHANGEPERMS, 'P' ],
            [ P_READPERMS, 'p' ],
            [ P_TAKEOWNERSHIP, 'O' ],
            [ P_READMETADATA, 'm' ],
            [ P_WRITEMETADATA, 'M' ],
            [ P_VIEWSYSTEMFILES, 'S' ],
            [ P_LOADOBJECT, 'l' ]
        ];

        let result = bits
            .map(s => (s[0] & flags) > 0 ? s[1] : '-')
            .join('');

        return result;
    }
}

class AclFileSecurity extends BaseFileSecurity {
    constructor(fileManager, fileSystem, options) {
        super(fileManager, fileSystem, options);

        /** @type {Object.<string, DirectoryAcl>} */
        this.aclCache = {};
    }

    /**
     * Get the Access Control List for the specified object.
     * @param {FileSystemObject} stat The stat to get an Acl for
     */
    async getAcl(stat) {
        if (stat.isFile) {
            let parent = await stat.getParent(),
                parentAcl = await this.getAcl(parent);
            return parentAcl;
        }
        else if (stat.isDirectory) {
            if (stat.path in this.aclCache)
                return this.aclCache[stat.path];

            let aclData = await driver.fileManager.getSystemFileAsync(stat.mapPath('.acl'), 1)
                .catch(err => {
                    console.log(`Failed to retreive ACL: ${err}`);
                });
            if (!aclData.exists) {
                let parent = await stat.getParent();
                if (parent) return await this.getAcl(parent);
            }
            if (typeof aclData.readJsonAsync === 'function') {
                let data = await aclData.readJsonAsync();
                return this.aclCache[stat.path] = new DirectoryAcl(aclData, data);
            }
            else {
                //  TODO: Add driver apply
                let fallback = new DirectoryAcl({ path: stat.path + '/.acl' }, {});
                return fallback;
            }
        }
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
        return this.validWriteFile( expr);
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
        let ecc = driver.getExecution(),
            acl = this.getAcl(stat);

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

module.exports = AclFileSecurity;
