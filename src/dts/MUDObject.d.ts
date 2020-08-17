
declare class MUDObject {
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
