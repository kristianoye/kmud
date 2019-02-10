﻿/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Module contains data storage for in-game objects.
 */
const
    MUDEventEmitter = require('./MUDEventEmitter'),
    MUDConfig = require('./MUDConfig'),
    MUDCreationContext = require('./MUDCreationContext'),
    ClientCaps = require('./network/ClientCaps');

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

        /** @type {MUDObject} The current environment */
        this.environment = null;

        this.filename = typeof owner === 'object' ?
            owner.filename :
            typeof owner === 'string' && owner;

        this.flags = 0;

        /** @type {MUDObject[]}} All of the inventory contained with the object */
        this.inventory = [];

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
    }

    /**
     * 
     * @param {string} cmdline
     */
    command(cmdline) {
        let client = this.getProtected('$client'), evt,
            prevPlayer = driver.thisPlayer;

        try {
            if (client) {
                client.createCommandEvent(cmdline);
            }
            else {
                let words = cmdline.split(/\s+/g),
                    verb = words.shift();
                evt = {
                    verb: verb,
                    args: words
                };
            }
            driver.setThisPlayer(this.owner, false, evt.verb);
            this.emit('kmud.command', evt);
        }
        finally {
            driver.setThisPlayer(prevPlayer, false);
        }
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
     * Probably very inaccurate but it will do for now...
     * @returns {number} A guess as to how much memory the object is using.
     */
    getSizeOf() {
        let data = this.serialize(true),
            size = JSON.stringify(data).length;
        return size;
    }

    /**
     * Increment a numeric property by a specified amount.
     * @param {string} prop
     * @param {number} incrementBy
     * @param {number} initialValue
     */
    incrementProperty(prop, incrementBy, initialValue) {
        if (!(prop in this.properties))
            this.properties[prop] = parseInt(initialValue);
        this.properties[prop] += incrementBy;
        return this.owner;
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
    setClient(client) {
        if (client) {
            this.flags |= MUDStorage.OB_CONNECTED | MUDStorage.OB_INTERACTIVE;
            this.setSymbol('$client', client);
            this.setSymbol('$clientCaps', client.caps);
            client.on('disconnected', this.onDisconnect = client => {
                this.setClient(false);
            });
        }
        else {
            this.flags &= ~MUDStorage.OB_CONNECTED;
            this.setSymbol('$client', false);
            this.setSymbol('$clientCaps', false);

            if (this.client && this.onDisconnect) {
                this.client.off('disconnected', this.onDisconnect);
                this.onDisconnect = false;
            }
        }
        this.client = client;
        return this;
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
        return this.storage[typeof ob === 'object' ? ob.filename : ob] || false;
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
MUDStorage.OB_INTERACTIVE = 1 << 0;

/** Indicates the object is connected (not linkdead) */
MUDStorage.OB_CONNECTED = 1 << 1;

/** Indicates the object is living and can execute commands */
MUDStorage.OB_LIVING = 1 << 2;

/** Indicates the object has wizard permissions */
MUDStorage.OB_WIZARD = 1 << 3;

/** Indicates the interactive object is idle */
MUDStorage.OB_IDLE = 1 << 4;

/** Indicates the object is in edit mode */
MUDStorage.OB_EDITING = 1 << 5;

/** Indicates the object is in input mode */
MUDStorage.OB_INPUT = 1 << 6;

module.exports = MUDStorage;

