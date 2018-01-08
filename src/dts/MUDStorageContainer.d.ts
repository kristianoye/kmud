
declare class MUDStorageContainer {
    /**
     * Creates a storage object for the specified instance and
     * takes the data from the object's creation context.
     * @param ob The newly created object.
     * @param ctx The object's constructor context.
     */
    create(ob: MUDObject, ctx: MUDCreationContext): MUDStorage;

    /**
     * Get the storage object for the specified object instance.
     * @param ob The object retrieving its storage.
     */
    get(ob: MUDObject): MUDStorage;

    /**
     * Indicates there is a new instance that should take control
     * of an existing object datastore.
     * @param item The new instance that matches an older instance.
     * @param ctx The new creation context.
     */
    reload(item: MUDObject, ctx: MUDCreationContext): MUDStorage;
}