const
    EventEmitter = require('events'),
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

        /** @type {Object.<Symbol,any>} */
        this.symbols = {};

        this.merge(ctx);
    }

    /**
     * Returns a property from the collection.
     * @param {string} prop
     * @param {any} defaultValue
     */
    getProperty(prop, defaultValue) {
        if (prop in this.properties)
            return this.properties[prop];
        else if (typeof defaultValue === 'undefined')
            return (this.properties[prop] = defaultValue);
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
     */
    setProperty(prop, value) {
        this.properties[prop] = value;
        return this.owner;
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

/**
 * @returns {MUDStorage} The storage object for the specified object.
 */
MUDStorage.get = function (/** @type {MUDObject} */ ob) {
    var result = MUDData.StorageObjects[ob._propKeyId] || false;
    if (result === false) throw new Error('Bad stuff happened!  Object has no storage.');
    return result;
};

/**
 * @returns {MUDStorage} Called if the object instance is reloaded.
 */
MUDStorage.reload = function (/** @type {MUDObject} */ ob) {
    var prev = MUDStorage.get(ob);
    return prev.reload(ob);
}

module.exports = MUDStorage;
