/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Module contains data storage for in-game objects.
 */
const
    MUDEventEmitter = require('./MUDEventEmitter'),
    MUDConfig = require('./MUDConfig'),
    MUDData = require('./MUDData'),
    MUDObject = require('./MUDObject'),
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
     * @param {MUDCreationContext} ctx The creation context used to create the owner.
     * @param {boolean} reload True if the object is only being reloaded.
     */
    constructor(owner, ctx, reload) {
        super();

        /** @type {MUDObject} The current environment */
        this.environment = null;

        this.filename = owner ? owner.filename : '';

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

        if (ctx) this.merge(ctx);
    }

    command(cmdline) {
        let client = this.getProtected('$client'), evt,
            prevPlayer = MUDDdata.ThisPlayer;

        try {
            if (client) {
                client.createCommandEvent(cmdline);
            }
            MUDData.ThisPlayer = this.owner;
            this.emit('kmud.command', evt);
        }
        finally {
            MUDData.ThisPlayer = prevPlayer;
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
     * @param {string} prop
     * @param {any=} defaultValue
     */
    getProperty(prop, defaultValue) {
        return this.properties[prop] || (this.properties[prop] = defaultValue);
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
     * Merge properties from a context.
     * @param {MUDCreationContext} ctx The context to merge from
     */
    merge(ctx) {
        Object.keys(ctx.private).forEach(key => {
            this.private[key] = ctx.private[key];
        });
        Object.keys(ctx.props).forEach(key => {
            this.properties[key] = ctx.props[key];
        });
        Object.keys(ctx.protected).forEach(key => {
            this.protected[key] = ctx.protected[key];
        });
        Object.getOwnPropertySymbols(ctx.symbols).forEach(key => {
            this.symbols[key] = ctx.symbols[key];
        });
        return this;
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
     * Restore the storage object.  Is this used?
     * @param {any} data
     */
    restore(data) {
        // TODO: Restore inventory / object references
        this.properties = data.props || {};
        this.protected = data.protected || {};
        this.private = data.private || {};
        this.emit('kmud.restored', this);
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
                let value = this.private[prop], uw = unwrap(value);
                if (Array.isArray(value)) result.private[prop] = this.serializeArray(value, backrefs);
                else if (uw) result.private[prop] = this.serializeMudObject(uw, backrefs);
                else if (typeof value === 'object') result.private[prop] = this.serializeOtherObject(value, backrefs);
                else {
                    let s = this.serializeScalar(value);
                    if (s) result.private[prop] = s;
                }
            }
        });

        if (!propsOnly) {
            result.$environment = unwrap(this.environment, (env) => env.filename);
            result.$inventory = this.inventory.map(item => {
                let $storage = MUDStorage.get(item);
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
        let index = backrefs.indexOf(o) > -1;
        if (index > -1) return `OBJREF:${index}`;
        let $storage = MUDStorage.get(o);
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

        let result = {},
            type = o.constructor ? o.constructor.name : '$anonymous',
            file = o.constructor ? o.constructor.filename : false;

        Object.keys(o).forEach((prop, index) => {
            if (typeof prop === 'string') {
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
        if (type && file) {
            result.$$type = type;
            result.$$file = o.constructor.filename;
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

if (MUDConfig.readValue('driver.objectCreationMethod', 'inline') === 'inline') {
    MUDStorage.create = function (/** @type {MUDObject} */ ob, /** @type {MUDCreationContext} */ ctx) {
        return ctx.isReload ? MUDStorage.reload(ob, ctx) : MUDStorage.instances[ob._propKeyId] = new MUDStorage(ob, ctx);
    };
} else {
    MUDStorage.create = function (/** @type {MUDObject} */ ob, /** @type {MUDCreationContext} */ ctx) {
        return MUDStorage.get(ob).reload(ob, ctx);
    };
}

MUDStorage.createForId = function (/** @type {string}, */ filename, /** @type {number} */ id) {
    let instanceId = `${filename}.${id}`;
    return MUDStorage.instances[instanceId] = new MUDStorage(null, null);
};

/**
 * @returns {MUDStorage} The storage object for the specified object.
 */
MUDStorage.get = function (/** @type {MUDObject} */ ob) {
    if (typeof ob === 'function') ob = ob();
    return MUDStorage.instances[unwrap(ob)._propKeyId];
};

/**
 * @type {Object.<string,MUDStorage>}
 */
MUDStorage.instances = {};

/**
 * @returns {MUDStorage} Called if the object instance is reloaded.
 */
MUDStorage.reload = function (/** @type {MUDObject} */ ob, /** @type {MUDCreationContext} */ ctx) {
    return MUDStorage.get(ob).reload(ob, ctx);
};

MUDData.Storage = MUDStorage;
module.exports = MUDStorage;
