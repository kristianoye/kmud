class CreationContext {
    /**
     * Construct information needed to create an in-game object
     * @param {CreationContext} data Data about the request
     * @param {boolean} isVirtual Is the instance being created virtually?
     */
    constructor(data, isVirtual = false) {
        /** 
         * Constructor args 
         * @type {any[]} */
        this.args = data.args || [];

        /** 
         * The path to the object being created
         * @type {string} 
         */
        this.filename = data.filename;

        /**
         * The path to the object being created including extension
         * @type {string} 
         */
        this.fullPath = data.fullPath;

        /** 
         * Is this a virtual object request? 
         * @type {boolean}
         */
        this.isVirtual = data.isVirtual === true;

        /** 
         * The module that defines the type
         * @type {MUDModule} 
         */
        this.module = data.module;

        /** 
         * The object's highly unique UUID.  Safe for multi-process MUDs.
         * @type {string} 
         */
        this.objectId = data.objectId;

        /**
         * If this is a virtual object, this is a filename specifying details about
         * which module hosts it.
         * @type {string}
         */
        this.trueName = data.trueName;

        /**
         * The type name of this object instance
         * @type {string}
         */
        this.typeName = data.typeName;

        /**
         * The weak reference pointer for this object
         * @type {function(): object}
         */
        this.wrapper = data.wrapper;
    }
}

module.exports = CreationContext;
