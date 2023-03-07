const
    ConfigUtil = require('../ConfigUtil'),
    GameServer = require('../GameServer'),
    path = require('path');

class MudlibFileMount {
    constructor(mountAs, config, index) {
        /** @type {string} */
        this.type = config.type || './fs/DiskFileSystem';

        /** @type {number} */
        this.index = index;

        /** @type {string} */
        this.mountPoint = mountAs;

        /** @type {Object.<string,any>} */
        this.options = config.options || {};

        this.securityManager = config.securityManager;
        this.securityManagerOptions = config.securityManagerOptions || {};
    }

    assertValid() {
        ConfigUtil.assertType(this.mountPoint, `mudlib.fileSystem.fileSystemTable[${this.index}]`, 'string');
        ConfigUtil.assertType(this.options, `mudlib.fileSystem.fileSystemTable#[${this.index}] [${this.mountPoint }].options`, 'object');
        ConfigUtil.assertType(this.type, `mudlib.fileSystem.fileSystemTable#[${this.index}] [${this.mountPoint }].type`, 'string');
        ConfigUtil.assertExists(this.type);
    }
}

class MudlibFileSystem {
    constructor(config) {
        /** @type {string} */
        this.fileManager = config.fileManager || './fs/FileManager';
        this.fileManagerType = '';
        let n = this.fileManager.indexOf('@');
        if (n > -1) {
            this.fileManagerType = this.fileManager.substring(0, n);
            this.fileManager = this.fileManager.substring(n + 1);
        }

        /** @type {Object.<string,any>} */
        this.fileManagerOptions = config.fileManagerOptions || {};

        /** @type {string} */
        this.securityManager = config.securityManager || './fs/DefaultFileSecurity';

        /** @type {Object.<string,any>} */
        this.securityManagerOptions = config.securityManagerOptions || {};

        /** @type {Object.<string,MudlibFileMount>} */
        this.fileSystemTable = {};

        if (!config.fileSystemTable) {
            config.fileSystemTable = {
                "/": {
                    options: {
                        "path": path.join(__dirname, '..', '..', './lib'),
                        "readOnly": false
                    }
                }
            };
        }

        if (config.fileSystemTable) {
            Object.keys(config.fileSystemTable).forEach((dir, index) => {
                let fsconfig = config.fileSystemTable[dir];

                if (!fsconfig.securityManager)
                    fsconfig.securityManager = this.securityManager;

                if (!fsconfig.securityManagerOptions)
                    fsconfig.securityManagerOptions = this.securityManagerOptions;

                this.fileSystemTable[dir] = new MudlibFileMount(dir, fsconfig, index);
            });
        }
    }

    /**
     * Ensures that the filesystem settings are usable.
     */
    assertValid() {
        if (!('/' in this.fileSystemTable))
            throw new Error('Filesystem configuration does not provide a root node!');
        ConfigUtil.assertExists(this.fileManager);
        ConfigUtil.assertExists(this.securityManager);
        this.eachFileSystem(fs => fs.assertValid());
    }

    /**
     * Construct the file manager.
     * @param {GameServer} driver A reference to the driver instance.
     */
    async createFileManager(driver) {
        let manager = undefined, managerType;

        if (this.fileManagerType) {
            let fileManagerExports = require(path.join(__dirname, '..', this.fileManager));
            managerType = fileManagerExports[this.fileManagerType];
        }
        else
            managerType = require(path.join(__dirname, '..', this.fileManager));

        if (typeof managerType === 'function')
            manager = new managerType(this);
        else if (typeof managerType === 'object')
            manager = managerType;

        if (typeof manager.FileManager === 'object')
            manager = manager.FileManager;

        return manager.assertValid() && manager;
    }

    /**
     * Construct the security model.
     * @param {GameServer} driver 
     */
    createSecurityManager(driver) {
        let manager = require(path.join(__dirname, '..', this.securityManager)),
            result = new manager(driver, this.securityManagerOptions);
        return result.assertValid() || result;
    }

    /**
     * Perform callback for each mount point.
     * @param {function(MudlibFileMount,string=):any} callback
     * @returns {any[]}
     */
    eachFileSystem(callback) {
        return new Promise(async (resolve, reject) => {
            try {
                let keys = Object.keys(this.fileSystemTable);
                for (let i = 0; i < keys.length; i++) {
                    let dir = keys[i];
                    let entry = this.fileSystemTable[dir];

                    if (callback.toString().startsWith('async'))
                        await callback(entry, i, dir);
                    else
                        callback(entry, i, dir);
                }
                resolve(true);
            }
            catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = { MudlibFileSystem, MudlibFileMount };
