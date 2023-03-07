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
         * Constructor implementation 
         * @type {function(): MUDObject} */
        this.constructor = data.constructor || false;

        /** 
         * The path to the object being created
         * @type {string} */
        this.filename = data.filename;

        /** 
         * The unique instance ID of the object being created
         * @type {string|number} */
        this.instanceId = data.instanceId;

        /** Is this a virtual object request? */
        this.isVirtual = data.isVirtual === true;

        /** @type {MUDModule} */
        this.module = data.module;

        /** @type {string} */
        this.uuid = data.uuid;
    }
}

module.exports = CreationContext;
