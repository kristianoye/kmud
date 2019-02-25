/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Module contains data storage for in-game objects.
 */
const
    MUDEventEmitter = require('./MUDEventEmitter'),
    MUDCreationContext = require('./MUDCreationContext'),
    ClientCaps = require('./network/ClientCaps'),
    CommandShell = require('./CommandShell'),
    StandardIO = require('./StandardIO');

/**
 * Storage for MUD Objects.  In-game objects do not hold their data directly.
 * The storage object provides public, protected, and private data as well as
 * a signal mechanism between the driver and the in-game object for important
 * events like heartbeats and connection status (to protect against fake calls)
 */
class MUDStorage extends MUDEventEmitter {
    /**
     * Construct a storage object.
     * @param {MUDObject} owner The owner of the storage object.
     */
    constructor(owner) {
        super();

        this.client = false;
        this.clientCaps = ClientCaps.DefaultCaps;

        /** @type {MUDObject} The current environment */
        this.environment = null;

        this.filename = typeof owner === 'object' ?
            owner.filename :
            typeof owner === 'string' && owner;

        this.flags = 0;

        /** @type {MUDObject[]}} All of the inventory contained with the object */
        this.inventory = [];

        /** @type {number|false} */
        this.heartbeatIndex = false;
        this.interactiveIndex = false;
        this.livingIndex = false;
        this.playerIndex = false;
        this.wizardIndex = false;

        /** The time at which this object's client did something */
        this.lastActivity = 0;

        /** @type {number} */
        this.nextReset = 0;

        /** @type {MUDObject} The owner of the storage objects */
        this.owner = owner;

        /** @type {Object.<string,any>} */
        this.private = {};

        /** @type {Object.<string,any>} */
        this.properties = {};

        /** @type {Object.<string,any>} */
        this.protected = {};

        /** @type {Object.<Symbol,any>} */
        this.symbols = {};

        /** @type {Object.<string,{value:any, definer:string, access:number}>} */
        this.data = {};

        /** @type {Object.<string,{value:any, definer:string, access:number}>} */
        this.privateData = {};
    }

    /**
     * 
     * @param {MUDObject} thisObject The object to associate data with
     * @param {function} definingType
     * @param {string} key The key to set/create
     * @param {any} value The value (or undef to delete)
     * @param {any} access
     * @param {any} initMode
     */
    set(thisObject, definingType, file, key, value, access = 2, initMode = false) {
        let inc = access & 128;
        access &= ~128;
        let ptr = access === 3 ? this.privateData : this.data,
            definer = definingType.type ?
                definingType.type.prototype.baseName :
                definingType.prototype.baseName,

            //  This set/get/register is taking place in a constructor of definer type
            thisBase = definingType.type ? definer : 
                thisObject.constructor.prototype.baseName,
            keyPath = key.split('/').filter(s => s.length),
            keyName = [],
            keySize = keyPath.length;

        if (access === 3) {
            if (thisBase !== definer && definer !== file)
                throw new Error(`Illegal attempt to access private data.`);

            if (definer in ptr === false) {
                ptr = ptr[definer] = {};
            }
        }
        while(--keySize) {
            let subkey = keyPath.shift();

            if (subkey in ptr === false) 
                ptr = ptr[subkey] = keySize ? {} : value;
            else
                ptr = ptr[subkey];

            keyName.push(subkey);

            if (!efuns.isPOO(ptr)) {
                throw new Error(`Illegal value key ${key}; ${keyName.join('/')} already exists as value.`);
            }
        }

        keyName = keyPath[0];

        if (keyName in ptr === false) {
            ptr[keyName] = value;
        }
        else if (efuns.isPOO(value)) {
            Object.keys(value).forEach(subkey => {
                this.set(thisObject, definingType, file, key + '/' + subkey, value[subkey], access, initMode);
            });
            return this.owner;
        }
        else if (!initMode)
            ptr[keyName] = inc ? (ptr[keyName] || 0) + value : value;

        return this.owner;
    }

    /**
     * Pass the heartbeat on to the in-game object.
     * @param {number} total
     * @param {number} ticks
     */
    eventHeartbeat(total, ticks) {
        if (this.lastActivity) {
            if (this.idleTime > this.maxIdleTime) {
                this.heartbeat = false;
                return this.setClient(false, 'You have been idle for too long.');
            }
        }
        this.owner.heartbeat(total, ticks);
    }

    get connected() {
        return this.hasFlag(MUDStorage.PROP_CONNECTED);
    }

    set connected(flag) {
        return this.flag(MUDStorage.PROP_CONNECTED, flag);
    }

    get heartbeat() {
        return this.hasFlag(MUDStorage.PROP_HEARTBEAT);
    }

    set heartbeat(flag) {
        this.flag(MUDStorage.PROP_HEARTBEAT, flag);
    }

    get interactive() {
        return this.hasFlag(MUDStorage.PROP_INTERACTIVE);
    }

    set interactive(flag) {
        return this.flag(MUDStorage.PROP_INTERACTIVE, flag);
    }

    get maxIdleTime() {
        return this.owner && this.owner.maxIdleTime || 0;
    }

    get living() {
        return this.hashFlag(MUDStorage.PROP_LIVING);
    }

    set living(flag) {
        if (typeof flag === 'string') {
            this.livingName = flag;
        }
        this.flag(MUDStorage.PROP_LIVING, flag !== false);
    }

    get player() {
        return this.hasFlag(MUDStorage.PROP_ISPLAYER);
    }

    set player(flag) {
        if (typeof flag === 'string') {
            this.playerName = flag;
        }
        this.flag(MUDStorage.PROP_ISPLAYER, flag !== false);
    }

    /**
     * Check to see if the object has a certain flag enabled.
     * @param {number} flag One or more flags to check.
     * @returns {boolean} True if the flag is set.
     */
    hasFlag(flag) {
        return (this.flags & flag) > 0;
    }

    /**
     * Indicates how long this object has been active.
     * @returns {number} Returns the object's idle time in miliseconds.
     */
    get idleTime() {
        if (this.lastActivity > 0)
            return (efuns.ticks - this.lastActivity);
        else
            return 0;
    }

    get(thisObject, definingType, file, key, defaultValue, access = 2) {
        let ptr = access === 3 ? this.privateData : this.data,
            definer = definingType.type ?
                definingType.type.prototype.baseName :
                definingType.prototype.baseName,

            //  This set/get/register is taking place in a constructor of definer type
            thisBase = definingType.type ? definer :
                thisObject.constructor.prototype.baseName,
            keyPath = key.split('/').filter(s => s.length),
            keySize = keyPath.length;

        if (access === 3) {
            if (thisBase !== definer && definer !== file)
                throw new Error(`Illegal attempt to access private data.`);

            if (definer in ptr === false) {
                ptr = ptr[definer] = {};
            }
            else {
                ptr = ptr[definer];
            }
        }
        while (--keySize) {
            let subkey = keyPath.shift();

            if (subkey in ptr === false)
                return defaultValue;
            else
                ptr = ptr[subkey];
        }
        if (keyPath[0] in ptr === false && defaultValue) {
            return ptr[keyPath[0]] = defaultValue;
        }
        return ptr[keyPath[0]] || defaultValue;
    }

    flag(flag, setFlag = true) {
        let andFlag = setFlag ? flag : ~flag;

        if ((this.flag & andFlag) !== this.flag) {
            switch (flag) {
                case MUDStorage.PROP_CONNECTED:
                case MUDStorage.PROP_EDITING:
                case MUDStorage.PROP_IDLE:
                case MUDStorage.PROP_INPUT:
                case MUDStorage.PROP_DESTRUCTED:
                    break;

                case MUDStorage.PROP_HEARTBEAT:
                    if (this.owner && typeof this.owner.heartbeat === 'function') {
                        driver.setHeartbeat(this, setFlag);
                    }
                    break;

                case MUDStorage.PROP_INTERACTIVE:
                    driver.setInteractive(this, setFlag);
                    break;

                case MUDStorage.PROP_LIVING:
                    driver.setLiving(this, setFlag);
                    break;

                case MUDStorage.PROP_ISPLAYER:
                    driver.setPlayer(this, setFlag);
                    break;

                case MUDStorage.PROP_WIZARD:
                    driver.setWizard(this, setFlag);
                    break;

                default:
                    throw new Error(`Attempted to set meaningless bit flag: ${flag}`);
            }
            if (setFlag)
                this.flags |= flag;
            else
                this.flags &= ~flag;
        }
    }

    /**
     * 
     * @param {string} cmdline
     */
    command(cmdline) {
        return driver.driverCall('command', ecc => {
            ecc.withPlayer(this, player => {
                let cmd = player.processInput(cmdline);
                return cmd.executeCommand(cmd);
            });
        });
    }

    /**
     * Destroys the object.
     */
    eventDestroy(...args) {
        if (!this.destroyed) {
            let parts = efuns.parsePath(this.owner.filename),
                module = driver.cache.get(parts.file);

            this.heartbeat = false;

            if (this.client)
                this.setClient(false, ...args);

            if (this.environment)
                this.owner.emit('kmud.item.removed', this.environment);

            if (this.player) this.player = false;

            this.owner.removeAllListeners && this.owner.removeAllListeners();
            driver.storage.delete(this.owner);

            this.owner = false;
            this.destroyed = true;

            if (this.shell) {
                this.shell.destroy();
                this.shell = undefined;
            }

            return this.destroyed = module.destroyInstance(parts);
        }
        return false;
    }

    get destroyed() { return this.hasFlag(MUDStorage.PROP_DESTRUCTED); }

    set destroyed(value) {
        if (value) this.flag(MUDStorage.PROP_DESTRUCTED, true);
    }


    executeCommand(rawcmd) {
        return driver.driverCall('executeCommand', context => {
            let cmd = {
                verb: rawcmd.verb.value,
                args: rawcmd.args.map(a => a.value),
                text: rawcmd.text
            };
            return context.withPlayer(this, player => player.executeCommand(cmd), false);
        }, this.filename, true);
    }

    /**
     * @returns {ClientCaps} Returns the client capabilities.
     */
    getClientCaps() {
        return this.protected['$clientCaps'] || false;
    }

    /**
     * Returns a private property from the collection.
     * @param {string} fileName The name of the file getting private data.
     * @param {string} prop The name of the property to fetch.
     * @param {any=} defaultValue An optional default value if property is not set.
     */
    getPrivate(fileName, prop, defaultValue) {
        let exists = fileName in this.private;
        if (!exists) {
            if (typeof defaultValue === 'undefined')
                return defaultValue;
            this.private[fileName] = {};
        }
        return this.private[fileName][prop] || (this.private[fileName][prop] = defaultValue);
    }

    /**
     * Returns a property from the collection.
     * @param {string} propName The name of the property to return.
     * @param {any} defaultValue The default value
     */
    getProperty(propName, defaultValue = undefined, evalFunctions = false) {
        let result = this.properties[propName];

        if (typeof result === 'undefined' && typeof defaultValue !== 'undefined') {
            if (evalFunctions && typeof defaultValue === 'function') {
                return this.properties[propName] = defaultValue();
            }
            return this.properties[propName] = defaultValue;
        }
        return result;
    }

    /**
     * Returns a protected/volatile property.
     * @param {string} prop
     * @param {any} defaultValue
     */
    getProtected(prop, defaultValue) {
        if (prop in this.protected)
            return this.protected[prop];
        else if (typeof defaultValue !== 'undefined')
            return this.protected[prop] = defaultValue;
    }

    /**
     * Retun the value stored for the given symbol.
     * @param {Symbol} prop
     * @param {any} defaultValue
     */
    getSymbol(prop, defaultValue) {
        if (prop in this.symbols)
            return this.symbols[prop];
        else if (typeof defaultValue !== 'undefined')
            return this.symbols[prop] = defaultValue;
    }

    /**
     * Re-associate a new object instance with an existing storage object.
     * @param {MUDObject} owner The new owner of this storage
     * @param {MUDCreationContext} ctx The context from the reload
     * @returns {MUDStorage} Returns existing storage object. 
     */
    reload(owner, ctx) {
        if (this.owner !== owner) {
            this.emit('kmud.reload');
            this.removeAllListeners();
            this.owner = owner;
            this.filename = owner ? owner.filename : '';
        }
        return this.merge(ctx);
    }

    addInventory(item) {
        let wrapped = wrapper(item),
            itemStore = driver.storage.get(item);

        //  Just in case...
        itemStore.leaveEnvironment();
        this.inventory.push(wrapped);
        itemStore.environment = this.owner;

        return true;
    }

    leaveEnvironment() {
        unwrap(this.environment, env => {
            let store = driver.storage.get(env);
            store && store.removeInventory(this);
        })
    }

    removeInventory(item) {
        let list = [];
        this.inventory.forEach((ow, i) => {
            if (ow.filename === item.filename) list.push(i);
        });
        if (list.length === 0)
            return false;
        while (list.length) {
            this.inventory.splice(list.pop(), 1);
        }
        return true;
    }

    /**
     * Removes a symbol from the storage.
     * @param {string} prop The property to remove
     */
    removeSymbol(prop) {
        delete this.symbols[prop];
        return this;
    }

    /**
     * Restore the storage object.  Is this used?
     * @param {any} data
     */
    restore(data) {
        let backRefs = [this.owner];

        this.properties = data.props || {};
        this.protected = this.restoreObject(data.protected || {}, backRefs);
        this.private = data.private || {};
        this.emit('kmud.restored', this);
    }

    restoreX(item, backRefs) {
        if (Array.isArray(item)) {
            return this.restoreArray(item, backRefs);
        }
        else if (typeof item === 'object') {
            return this.restoreObject(item, backRefs);
        }
        else if (typeof item === 'string' && item.startsWith('OBJREF:')) {
            let refId = parseInt(item.slice(7));
            if (refId > backRefs.length)
                throw new Error(`restore() failure; Reference ${item} does not exist.`);
            return backRefs[refId];
        }
        else {
            return item;
        }
    }
    /**
     * Restore an array.
     * @param {any[]} data
     * @param {object[]} backrefs
     */
    restoreArray(data, backRefs) {
        return data.map((item, index) => this.restoreX(item, backRefs));
    }

    /**
     * Restore an object.
     * @param {Object.<string,any>} data An object being restored.
     * @param {object[]} backrefs Reference to objects already created.
     */
    restoreObject(data, backRefs) {
        let r = {};
        if (data.$$type && data.$$file) {
            let ttype = driver.cache.getType(data.$$file, data.$$type);

            if (ttype && typeof ttype.restore === 'function') {
                r = ttype.restore(data);
            }
            else if (ttype) {
                r = new ttype(data);
                delete data['$$type'];
                delete data['$$file'];
                Object.keys(data).forEach((key, index) => {
                    r[key] = this.restoreX(data[key], backRefs);
                });
            }
            if (typeof r !== 'object' || r === null)
                throw new Error(`restore() failure; Could not create type '${data.$$type}'`);
            backRefs.push(r);
        }
        else {
            Object.keys(data).forEach((key, index) => { r[key] = this.restoreX(data[key], backRefs); });
        }
        return r;
    }

    /**
     * Serialize the MUD object state into a format that can be stored
     * and reconstituted later.
     */
    serialize(flag, backrefs) {
        let result = {
            private: {},
            props: {},
            protected: {}
        }, propsOnly = flag || false;

        if (!backrefs) backrefs = [this.owner];

        Object.keys(this.properties).forEach((prop, index) => {
            // Values starting with $ are considered volatile and not serialized.
            if (typeof prop === 'string' && !prop.startsWith('$')) {
                let value = this.properties[prop],  uw = unwrap(value);
                if (Array.isArray(value)) result.props[prop] = this.serializeArray(value, backrefs);
                else if (uw) result.props[prop] = this.serializeMudObject(uw, backrefs);
                else if (typeof value === 'object') result.props[prop] = this.serializeOtherObject(value, backrefs);
                else {
                    let s = this.serializeScalar(value);
                    if (s) result.props[prop] = s;
                }
            }
        });

        Object.keys(this.protected).forEach((prop, index) => {
            // Values starting with $ are considered volatile and not serialized.
            if (typeof prop === 'string' && !prop.startsWith('$')) {
                let value = this.protected[prop], uw = unwrap(value);
                if (Array.isArray(value)) result.protected[prop] = this.serializeArray(value, backrefs);
                else if (uw) result.protected[prop] = this.serializeMudObject(uw, backrefs);
                else if (typeof value === 'object') result.protected[prop] = this.serializeOtherObject(value, backrefs);
                else {
                    let s = this.serializeScalar(value);
                    if (s) result.protected[prop] = s;
                }
            }
        });

        Object.keys(this.private).forEach((prop, index) => {
            // Values starting with $ are considered volatile and not serialized.
            if (typeof prop === 'string' && !prop.startsWith('$')) {
                let data = this.private[prop],
                    priv = result.private[prop] = {};

                Object.keys(data).forEach((innerProp, index2) => {
                    if (typeof innerProp === 'string' && !innerProp.startsWith('$')) {
                        let value = data[innerProp], uw = unwrap(value);
                        if (Array.isArray(value)) priv[innerProp] = this.serializeArray(value, backrefs);
                        else if (uw) priv[innerProp] = this.serializeMudObject(uw, backrefs);
                        else if (typeof value === 'object') priv[innerProp] = this.serializeOtherObject(value, backrefs);
                        else {
                            let s = this.serializeScalar(value);
                            if (s) priv[innerProp] = s;
                        }
                    }
                });
            }
        });

        if (!propsOnly) {
            result.$environment = unwrap(this.environment, (env) => env.filename);
            result.$inventory = this.inventory.map(item => {
                let $storage = driver.storage.get(item);
                return $storage ? $storage.serialize() : false;
            }).filter(s => s !== false);
        }

        result.$filename = this.filename;

        return result;
    }

    /**
     * Serialize an array for storage
     * @param {Array<any>} a
     */
    serializeArray(a, backrefs) {
        return a.map((el, i) => {
            var uw = unwrap(el);
            if (Array.isArray(el)) return this.serializeArray(el, backrefs);
            else if (uw) return this.serializeMudObject(uw, backrefs);
            else if (typeof el === 'object') return this.serializeOtherObject(el, backrefs);
            else return this.serializeScalar(el, backrefs);
        });
    }

    /**
     * Serialize an object for storage.
     * @param {MUDObject} o The object to serialize
     */
    serializeMudObject(o, backrefs) {
        let index = backrefs.indexOf(o);
        if (index > -1) return `OBJREF:${index}`;
        let $storage = driver.storage.get(o);
        if ($storage) {
            let data = $storage.serialize(false, backrefs);
            data.$$type = o.filename;
            return data;
        }
        return null;
    }

    serializeOtherObject(o, backrefs) {
        if (o === null)
            return null;

        let index = backrefs.indexOf(o);
        if (index > -1)
            return `OBJREF:${index}`;

        let result = {},
            type = o.constructor ? o.constructor.name : '$anonymous',
            file = o.constructor ? o.constructor.filename : false;

        Object.keys(o).forEach((prop, index) => {
            if (typeof prop === 'string' && !prop.startsWith('$')) {
                let value = o[prop], uw = unwrap(value);

                if (Array.isArray(value)) result[prop] = this.serializeArray(value, backrefs);
                else if (uw) result[prop] = this.serializeMudObject(uw, backrefs);
                else if (typeof value === 'object') result[prop] = this.serializeOtherObject(value, backrefs);
                else {
                    let s = this.serializeScalar(value);
                    if (s) result[prop] = s;
                }
            }
        });
        if (type && file && type !== 'Object') {
            result.$$type = type;
            result.$$file = file;
        }
        return result;
    }

    serializeScalar(v) {
        let vt = typeof v;
        if (['string', 'boolean', 'number'].indexOf(vt) === -1)
            return null;
        else return v;
    }

    /**
     * Associate a client with this store and its related object.
     * @param {any} client
     */
    setClient(client, ...args) {
        try {
            if (client) {
                let streams;

                //  If the client has an old body, the client needs to be dissassociated with it
                if (client.body) {
                    let store = driver.storage.get(client.body);
                    if (store) {
                        driver.driverCall('disconnect', context => {
                            store.connected = false;
                            store.interactive = false;
                            store.connected = false;
                            store.lastActivity = 0;
                            if (store.shell) {
                                //  Take the I/O streams from the old shell
                                streams = store.shell.releaseStreams();
                            }
                            context.withPlayer(store, player => player.disconnect());
                            store.client = false;
                            store.clientCaps = ClientCaps.DefaultCaps;
                        });
                    }
                    else
                        return false;
                }

                this.connected = true;
                this.interactive = true;
                this.lastActivity = efuns.ticks;

                client.body = wrapper(this.owner);
                client.storage = this;

                this.client = client;
                this.clientCaps = client.caps;

                //  Linkdeath
                client.once('disconnected', () => {
                    driver.driverCall('disconnect', ecc => {
                        ecc.withPlayer(this, player => {
                            player.disconnect()
                        });
                    });
                });

                //  Connect to the new body
                driver.driverCall('connect', context => {
                    if (!this.shell) {
                        this.shell = new CommandShell({}, this, streams);
                    }
                    let shellSettings = context.withPlayer(this, player => player.connect(...args), false);
                    this.shell.update(shellSettings);
                    context.whenCompleted(() => {
                        this.shell.renderPrompt();
                    });
                });
                return true;
            }
            else {
                if (this.connected)
                    driver.driverCall('disconnect', context => {
                        if (this.shell) this.shell.flushAll();
                        let client = this.client;
                        this.connected = false;

                        if (this.client)
                            this.client.populateContext(true, context);
                        try {
                            context.withPlayer(this, player => player.disconnect(...args));
                        }
                        finally {
                            client && client.close();
                        }
                    });
                if (this.client) this.client.body = false;
                this.client = false;
                this.clientCaps = ClientCaps.DefaultCaps;
            }
            return true;
        }
        catch (err) {
            logger.log('Error in setClient: ', err);
        }
        return false;
    }

    /**
     * Set a "private" value.  Private values should only be accessed by the
     * module that defines them.
     * @param {string} file The module defining the value (must be ancestor)
     * @param {string} key The property name to store.
     * @param {any} val Any associated value
     * @returns {MUDStorage} The storage object.
     */
    setPrivate(file, key, val) {
        let exists = file in this.private;
        if (!exists)
            this.private[file] = {};
        this.private[file][key] = val;
        return this;
    }

    /**
     * Set a property in the storage object.
     * @param {string} prop
     * @param {any} value
     * @returns {MUDStorage}
     */
    setProperty(prop, value) {
        this.properties[prop] = value;
        return this;
    }

    /**
     * Set a property in the storage object.
     * @param {string} prop The protected property to set.
     * @param {any} value The value to be stored
     * @param {function=} callback A callback that fires once the value is set.
     * @returns {MUDStorage}
     */
    setProtected(prop, value, callback) {
        this.protected[prop] = value;
        if (callback) callback(this, value, prop);
        return this;
    }

    /**
     * Set a symbol-based property in the storage object.
     * @param {Symbol} prop The symbol to set a value for
     * @param {any} value The associated value
     */
    setSymbol(prop, value) {
        this.symbols[prop] = value;
        return this.owner;
    }
}

class MUDStorageContainer {
    constructor() {
        /** @type {Object.<string,MUDStorage>} */
        this.storage = {};
    }

    /**
     * @param {MUDObject} ob
     */
    create(ob) {
        return this.storage[ob.filename] = new MUDStorage(ob);
    }

    createForId(filename) {
        return this.storage[filename] = new MUDStorage(filename);
    }

    /**
     * Delete an object's data from storage.
     * @param {MUDObject} ob
     */
    delete(ob) {
        if (typeof ob === 'string') {
            let store = this.storage[ob];
            if (store) delete this.storage[ob];
            return !!store;
        }
        return unwrap(ob, item => {
            let instanceId = item._propKeyId;
            if (instanceId in this.storage) {
                delete this.storage[instanceId];
                return true;
            }
            return false;
        });
    }

    /**
     * Fetch storage for the specified argument.
     * @param {MUDObject} ob The file to fetch storage for.
     * @returns {MUDStorage} The storage object for the item or false.
     */
    get(ob) {
        return unwrap(ob, target => {
            return this.storage[target.filename];
        });
    }

    /**
     * Re-assocate the storage with the new instance reference.
     * @param {MUDObject} item
     * @param {MUDCreationContext} ctx
     */
    reload(item, ctx) {
        return unwrap(item, ob => this.storage[ob.filename].reload(item, ctx));
    }
}

/**
 * @param {GameServer} driver
 * @returns {MUDStorageContainer}
 */
MUDStorage.configureForRuntime = function (driver) {
    let manager = new MUDStorageContainer();

    driver.storage = manager;
};

/** Indicates the object is interactive */
MUDStorage.PROP_INTERACTIVE = 1 << 0;

/** Indicates the object is connected (not linkdead) */
MUDStorage.PROP_CONNECTED = 1 << 1;

/** Indicates the object is living and can execute commands */
MUDStorage.PROP_LIVING = 1 << 2;

/** Indicates the object has wizard permissions */
MUDStorage.PROP_WIZARD = 1 << 3;

/** Indicates the interactive object is idle */
MUDStorage.PROP_IDLE = 1 << 4;

/** Indicates the object is in edit mode */
MUDStorage.PROP_EDITING = 1 << 5;

/** Indicates the object is in input mode */
MUDStorage.PROP_INPUT = 1 << 6;

/** Indicates the object has a heartbeat */
MUDStorage.PROP_HEARTBEAT = 1 << 7;

/** Indicates the object is (or was) a player */
MUDStorage.PROP_ISPLAYER = 1 << 8;

/** Indicates the object has been destroyed */
MUDStorage.PROP_DESTRUCTED = 1 << 9;

module.exports = MUDStorage;

