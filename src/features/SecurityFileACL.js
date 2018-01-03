/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides ACL-based file security.
 */
const
    DriverFeature = require('../config/DriverFeature'),
    FileSecurity = require('../FileSecurity'),
    FeatureBase = require('./FeatureBase'),
    ConfigUtil = require('../ConfigUtil'),
    MUDData = require('../MUDData'),
    path = require('path'),
    fs = require('fs');

const
    PERM_NONE = 0,            //  [Default] User cannot perform any action.
    PERM_READ = 1 << 0,       //  User can read existing files within ACL scope.
    PERM_WRITE = 1 << 1,      //  User can write to existing files within ACL scope.
    PERM_DELETE = 1 << 2,     //  Users with this perm can delete files within the ACL scope.
    PERM_CREATE = 1 << 3,     //  Users with this perm can create new files within the ACL scope.
    PERM_LOAD = 1 << 4,       //  Users with this perm can load/clone objects with this ACL.
    PERM_UNLOAD = 1 << 5,     //  Users with this perm can unload/destruct objects with this ACL.
    PERM_GRANT = 1 << 6,      //  Users/groups with this perm can modify permissions.
    PERM_NOLOAD = 1 << 7,     //  Files/directories with this perm cannot be loaded by compiler.
    PERM_NOINHERIT = 1 << 8,  //  Inherit permissions from parent (pass through if no perms apply).
    PERM_GETPERMS = 1 << 9,   //  The ability to read permissions on file/directory.
    PERM_LISTDIR = 1 << 10;   //  List directory contents.

class FileAcl {
    constructor(perms) {
        /** @type {string} */
        this.directory = perms.directory;

        /** @type {Object.<string,Object.<string,number>>} */
        this.files = perms.files || {};

        /** @type {string} */
        this.owner = perms.owner || 'SYSTEM';

        /** @type {Object.<string,int>} */
        this.permissions = perms.permissions;
    }

    addFile(path) {
        if (path in this.files)
            return false;
        this.files[path] = {};
        return true;
    }

    clone() {
        let result = {
            directory: this.directory,
            owner: this.owner,
            permissions: {}
        };
        Object.keys(this.permissions).forEach(id => {
            result.permissions[id] = this.permissions[id];
        });
        return result;
    }

    /**
     * Get a file specific ACL.
     * @param {string} file
     * @returns {Object.<string,int>}
     */
    get(file) {
        var result = this.clone();
        if (file in this.files) {
            let override = this.files[file],
                def = override['*default'] || PERM_NONE;
            if (def & PERM_NOINHERIT)
                result.permissions = {};
            Object.keys(override).forEach(id => {
                result.permissions[id] = override[id];
            });
        }
        return result;
    }
}

/**
 * Stores/caches file ACL objects.
 */
class FileAclCache {
    constructor(options) {
        this.applyCreatePerms = options.applyCreatePerms;

        /** @type {Object.<string,FileAcl>} */
        this.cache = {};

        this.driver = options.driver;

        this.master = options.master;

        /** @type {string} */
        this.shadowRoot = options.shadowRoot;
    }

    /**
     * 
     * @param {string} filename
     * @returns {FileAcl} The ACL for the specified file.
     */
    get(filename) {
        if (!filename.startsWith('/') || filename.indexOf('..') !== -1)
            throw new Error(`Illegal ACL request for path '${filename}'`);

        let isDirectory = filename.endsWith('/'),
            directoryName = filename.slice(0, isDirectory ? filename.length : filename.lastIndexOf('/')) + (isDirectory ? '' : '/'),
            shadowFile = path.resolve(this.shadowRoot, directoryName.slice(1), 'dir.acl'), result = false, dirty = false;

        if (directoryName in this.cache) {
            result = this.cache[directoryName];
        }
        else if (fs.existsSync(shadowFile)) {
            result = this.cache[directoryName] = this.loadAclFile(shadowFile);
        }
        else {
            let data = this.applyCreatePerms.call(this.master, directoryName);
            result = this.cache[filename] = new FileAcl({
                directory: directoryName,
                permissions: data
            });
            fs.readdirSync(MUDData.MudPathToRealPath(directoryName)).forEach(name => {
                result.addFile(name);
            });
            dirty = true;
        }
        if (!isDirectory) {
            dirty |= result.addFile(filename.slice(filename.lastIndexOf('/')+1));
        }
        if (dirty)
            this.createShadowFile(shadowFile, result);
        return result.get(filename);
    }

    /**
     * 
     * @param {string} file
     * @param {FileAcl} acl
     */
    createShadowFile(file, acl) {
        let parts = file.split(path.sep);
        for (let i = 1; i < parts.length; i++) {
            let dir = parts.slice(0, i).join(path.sep);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        }
        fs.writeFileSync(file, JSON.stringify(acl, null, 2));
    }

    /**
     * Load an existing ACL file from disk.
     * @param {any} file
     */
    loadAclFile(file) {
        let rawFile = MUDData.StripBOM(fs.readFileSync(file, 'utf8')),
            result = JSON.parse(rawFile);
        return new FileAcl(result);
    }

    /**
     * Convert permissions from master object into an ACL.
     * @param {string} expr
     */
    parsePerms(expr) {
        let perms = expr.split(''),
            flags = 0;

        perms.forEach(f => {
            switch (f) {
                case 'r': flags |= PERM_READ; break;
                case 'w': flags |= PERM_WRITE; break;
                case 'x': flags |= PERM_LISTDIR; break;

                case 'c': flags |= PERM_CREATE; break;
                case 'g': flags |= PERM_GRANT; break;
                case 'd': flags |= PERM_DELETE; break;
                case 'u': flags |= PERM_UNLOAD; break;
                case 'l': flags |= PERM_LOAD; break;
                case 'n': flags |= PERM_NOLOAD; break;
                case 'p': flags |= PERM_GETPERMS; break;

                case 'i': flags |= PERM_NOINHERIT; break;

                default:
                    throw new Error(`Unrecognized permission token: ${f} while parsing ID ${id} for file '${path}'`);
            }
        });
        return flags;
    }

    stat(filename) {
        let realPath = MUDData.MudPathToRealPath(filename);
        if (fs.existsSync(realPath)) {
            let result = fs.statSync(realPath);
            if (!result.isDirectory())
                result.directory = filename.slice(1, filename.lastIndexOf('/'));
            else
                result.directory = filename.slice(1, filename.length);

            if (!result.directory.endsWith('/'))
                result.directory += '/';

            result.exists = true;
            return result;
        }
        else {
            if (filename.endsWith('/'))
                result.directory = filename.slice(1);
            else
                result.directory = filename.slice(1, filename.lastIndexOf('/'));
            result.exists = false;
            return result;
        }
    }
}

/**
 * @type {FileAclCache}
 */
var AclCache = null;

class SecurityFileACLFeature extends FeatureBase {
    /**
     * @param {DriverFeature} config Config data
     * @param {Object.<string,boolean>} flags Flags indicating what features are available.
     */
    constructor(config, flags) {
        super(config, flags);

        /** @type {string} */
        this.accessDataFile = config.parameters.accessDataFile;

        /** @type {string} */
        this.shadowDirectory = config.parameters.shadowDirectory;

        //  Driver applies - Some ACLs may be re-used.  If you do not wish to define separate 
        //  permissions for loading and destructing objects then you may simply re-use the 
        //  'validRead' or set the name to false in which case all calls succeed.
        /** @type {string} */
        this.applyNameValidCreate = config.parameters.applyNameValidCreate || 'aclValidCreate';
        /** @type {string} */
        this.applyNameValidDelete = config.parameters.applyNameValidDelete || 'aclValidDelete';
        /** @type {string} */
        this.applyNameValidDestruct = config.parameters.applyNameValidDestruct || 'aclValidDestruct';
        /** @type {string} */
        this.applyNameValidGrant = config.parameters.applyNameValidGrant || 'aclValidGrant';
        /** @type {string} */
        this.applyNameValidLoad = config.parameters.applyNameValidLoad || 'aclValidLoad';
        /** @type {string} */
        this.applyNameValidRead = config.parameters.applyNameValidRead || 'aclValidRead';
        /** @type {string} */
        this.applyNameValidWrite = config.parameters.applyNameValidWrite || 'aclValidWrite';

        //  Master object applies
        /** @type {string} */
        this.applyNameCreatePerms = config.parameters.applyNameCreatePerms || 'createPermissions';
        /** @type {string} */
        this.applyNameModifyPerms = config.parameters.applyNameModifyPerms || 'modifyPermissions';
        /** @type {string} */
        this.applyNameQueryPerms = config.parameters.applyNameQueryPerms || 'queryPermissions';

        //  EFUN names
        /** @type {string} */
        this.efunNameQueryAcl = config.parameters.efunNameQueryAcl || false;
        /** @type {string} */
        this.efunValidRead = config.parameters.efunNameValidRead || 'validRead';
        /** @type {string} */
        this.efunValidWrite = config.parameters.efunNameValidWrite || 'validWrite';
    }

    assertValid() {
        ConfigUtil.assertType(this.shadowDirectory, 'shadowDirectory', 'string');
        ConfigUtil.assertType(this.applyNameValidRead, 'applyNameValidWrite', 'string');
        ConfigUtil.assertType(this.applyNameValidWrite, 'applyNameValidWrite', 'string');
    }

    createDriverApplies(gameServer, driverPrototype) {
        let feature = this;

        if (this.applyNameValidRead) {
            if (this.applyNameValidRead.indexOf('->') > -1)
                throw new Error('Parameter applyNameValidRead cannot be aliased.');
            driverPrototype[this.applyNameValidRead] = function (caller, path, perms) {
                let acl = AclCache.get(path);
            };
        }
        if (this.applyNameValidWrite) {
            if (this.applyNameValidWrite.indexOf('->') > -1)
                throw new Error('Parameter applyNameValidWrite cannot be aliased.');
            driverPrototype[this.applyNameValidWrite] = function (caller, path, perms) {

            };
        }
        if (this.applyNameValidCreate) {
            if (this.applyNameValidCreate.indexOf('->') > -1) {
                let [applyAlias, applyName] = this.applyNameValidCreate.split('->', 2);
                if (typeof driverPrototype[applyName] === 'function')
                    driverPrototype[applyAlias] = driverPrototype[applyName];
                else
                    throw new Error(`Could not create apply alias ${applyAlias} -> ${applyName}; ${applyName} has not been defined.`);
            }
            else {
                driverPrototype[this.applyNameValidCreate] = function (caller, path) {

                };
            }
        }
        if (this.applyNameValidDelete) {
            if (this.applyNameValidDelete.indexOf('->') > -1) {
                let [applyAlias, applyName] = this.applyNameValidDelete.split('->', 2);
                if (typeof driverPrototype[applyName] === 'function')
                    driverPrototype[applyAlias] = driverPrototype[applyName];
                else
                    throw new Error(`Could not create apply alias ${applyAlias} -> ${applyName}; ${applyName} has not been defined.`);
            }
            else {
                driverPrototype[this.applyNameValidDelete] = function (caller, path) {

                };
            }
        }
        if (this.applyNameValidDestruct) {
            if (this.applyNameValidDestruct.indexOf('->') > -1) {
                let [applyAlias, applyName] = this.applyNameValidDestruct.split('->', 2);
                if (typeof driverPrototype[applyName] === 'function')
                    driverPrototype[applyAlias] = driverPrototype[applyName];
                else
                    throw new Error(`Could not create apply alias ${applyAlias} -> ${applyName}; ${applyName} has not been defined.`);
            }
            else {
                driverPrototype[this.applyNameValidDestruct] = function (caller, path) {

                };
            }
        }
        if (this.applyNameValidGrant) {
            if (this.applyNameValidGrant.indexOf('->') > -1)
                throw new Error('Parameter applyNameValidGrant cannot be aliased.');

            driverPrototype[this.applyNameValidGrant] = function (caller, path, perms) {

            };
        }
        if (this.applyNameValidLoad) {
            if (this.applyNameValidLoad.indexOf('->') > -1) {
                let [applyAlias, applyName] = this.applyNameValidLoad.split('->', 2);
                if (typeof driverPrototype[applyName] === 'function')
                    driverPrototype[applyAlias] = driverPrototype[applyName];
                else
                    throw new Error(`Could not create apply alias ${applyAlias} -> ${applyName}; ${applyName} has not been defined.`);
            }
            else {
                driverPrototype[this.applyNameValidLoad] = function (caller, path) {

                };
            }
        }
    }

    createExternalFunctions(efunPrototype) {
        let feature = this;

        if (this.efunNameQueryAcl) {
            efunPrototype[this.efunNameQueryAcl] = function (filename) {
                let acl = AclCache.get(filename);
                return acl && acl.clone();
            };
        }
    }

    initialize(driver, master) {
        let shadowDir = path.resolve(__dirname, this.shadowDirectory),
            accessFile = path.resolve(__dirname, this.accessDataFile);

        if (!fs.existsSync(accessFile)) {
            console.log(`Could not locate specified access file '${accessFile}'`);
        }

        if (!fs.existsSync(shadowDir)) {
            console.log(`Initializing shadow filesystem in ${shadowDir}...`)
            fs.mkdirSync(shadowDir);
        }

        let rawFile = MUDData.StripBOM(fs.readFileSync(accessFile, 'utf8')),
            fileData = JSON.parse(rawFile);

        master.loadAclData(fileData);

        AclCache = new FileAclCache({
            applyCreatePerms: master[this.applyNameCreatePerms],
            driver: driver,
            master: master,
            shadowRoot: shadowDir
        });
    }
}

module.exports = SecurityFileACLFeature;
