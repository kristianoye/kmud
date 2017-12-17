const
    EventEmitter = require('events'),
    { MUDConfig } = require('./MUDConfig'),
    MUDData = require('./MUDData'),
    MUDObject = require('./MUDObject'),
    MUDCreationContext = require('./MUDCreationContext');

class MUDStorage extends EventEmitter {
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

        /** @type {MUDObject[]}} All of the inventory contained with the object */
        this.inventory = [];

        /** @type {MUDObject} The owner of the storage objects */
        this.owner = owner;

        /** @type {Object.<string,any>} */
        this.properties = {};

        /** @type {Object.<string,any>} */
        this.protected = {};

        /** @type {Object.<Symbol,any>} */
        this.symbols = {};

        if (ctx) this.merge(ctx);
    }

    /**
     * Returns a property from the collection.
     * @param {string} prop
     * @param {any} defaultValue
     */
    getProperty(prop, defaultValue) {
        return this.properties[prop] || (this.properties[prop] = defaultValue);
    }

    getProtected(prop, defaultValue) {
        if (prop in this.protected)
            return this.protected[prop];
        else if (typeof defaultValue === 'undefined')
            return (this.protected[prop] = defaultValue);
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
            return (this.symbols[prop] = defaultValue);
    }

    incrementProperty(prop, incrementBy, initialValue) {
        if (!(prop in this.properties)) this.properties[prop] = initialValue;
        this.properties[prop] += incrementBy;
        return this.owner;
    }

    /**
     * Merge properties from a context.
     * @param {MUDCreationContext} ctx The context to merge from
     */
    merge(ctx) {
        Object.keys(ctx._props).forEach(key => {
            this.properties[key] = ctx._props[key];
        });

        Object.getOwnPropertySymbols(ctx._symbols).forEach(key => {
            this.symbols[key] = ctx._symbols[key];
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
        }
        return this.merge(ctx);
    }

    /**
     * Set a property in the storage object.
     * @param {string} prop
     * @param {any} value
     * @returns {MUDObject}
     */
    setProperty(prop, value) {
        this.properties[prop] = value;
        return this.owner;
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
        return ctx.isReload ? MUDStorage.reload(ob, ctx) : (MUDStorage.instances[ob._propKeyId] = new MUDStorage(ob, ctx));
    };
} else {
    MUDStorage.create = function (/** @type {MUDObject} */ ob, /** @type {MUDCreationContext} */ ctx) {
        return MUDStorage.get(ob).reload(ob, ctx);
    };
}

MUDStorage.createForId = function (/** @type {string}, */ filename, /** @type {number} */ id) {
    let instanceId = `${filename}.${id}`;
    return (MUDStorage.instances[instanceId] = new MUDStorage(null, null));
}

/**
 * @returns {MUDStorage} The storage object for the specified object.
 */
MUDStorage.get = function (/** @type {MUDObject} */ ob) {
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
