
declare class MUDObject {
    /**
     * Called to see if this object can add the item in question to its inventory.
     * @param item The item attempting to enter the object's inventory.
     * @returns True if the object can be accepted, false or a string if not.
     */
    canAcceptItem(item: MUDObject): boolean | string;

    /**
     * Attempt to add an item to the object's inventory.
     * @param item The item being added to the inventory.
     * @returns True if successful or false or a message if not.
     */
    addInventory(item: MUDObject): boolean | string;

    /**
     * Called to see if this object can release the specified object that is leaving.
     * @param item The item being released from this object's inventory
     * @returns True if the object can be released.
     */
    canReleaseItem(item: MUDObject): boolean;

    /** Basename is like filename except the clone number is not attached */
    readonly basename: string;

    /** Contains the name of the directory the object was loaded from */
    readonly directory: string;

    /** Contains the name of the file the object was loaded from */
    readonly filename: string;

    /** Contains the instanceId of the object.  If > 0 then this object is a clone */
    readonly instanceId: number;

    /** What objects are inside this object */
    readonly inventory: MUDObject[];

    /** Contains an array of strings indicating what permissions the object has */
    readonly permissions: string[];

    /**
     *  Check to see if the object responds to a particular ID
     * @param {string} id The ID to check.
     * @returns {boolean}
     */
    matchesId(id: string): boolean;

    /**
     * Check to see if the object responds to a list of qualifiers.
     * @param {string[]} idList The list of adjectives and identifiers to check.
     * @returns {boolean} Returns true if the object matches all specified IDs.
     */
    matchesId(idList: string[]): boolean;

    /**
     * Attempt to move this object to a new environment
     * @param destination The target environment to move to
     */
    moveObjectAsync(destination: string | MUDObject): boolean;
}
