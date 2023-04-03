declare interface FileSystemQueryFlags {
    /** No options; Use defaults */
    readonly None: number;

    /** Show files that are marked as hidden */
    readonly ShowHiddenFiles: number;

    /** Allow system files in results */
    readonly ShowSystemFiles: number;

    /** Do not cross filesystems */
    readonly SingleFileSystem: number;

    /** Perform recursive search */
    readonly Recursive: number;

    /** Do not return normal files */
    readonly IgnoreFiles: number;

    /** Do not return directories */
    readonly IgnoreDirectories: number;
}

declare interface MUDFileSystemEfuns {
    FileSystemQueryFlags: FileSystemQueryFlags;
}

declare interface PathExpr {
    file: string;
    type: string;
    instance?: number;
    extension?: string;
    objectId?: string;
}

declare interface EFUNProxy {
    /**
     * Bind an arbitrary command to a function
     * @param verb
     */
    addAction(verb: string, callback: () => any): void;

    /**
     * Is the object an administrator?
     * @param target
     */
    adminp(target: MUDObject): boolean;

    /**
     * Is the object an arch administrator?
     * @param target
     */
    archp(target: MUDObject): boolean;

    /**
     * Check to see if the supplied plain text value matches an encrypted password
     * @param plainText The plain text entered by a user
     * @param cipherText The stored encrypted value
     * @param callback Optional callback
     */
    checkPassword(plainText: string, cipherText: string, callback?: (success: boolean) => void): boolean;

    /**
     * Clone an in-game object
     * @param filename The filename to clone
     * @param args Parameters to pass to the constructor
     */
    cloneObjectAsync(filename: string, ...args: any): Promise<MUDObject>;

    /**
     * Split text or array of strings into multiple columns
     * @param list The string or array of strings to format
     * @param width The maximum width to display the values in
     * @param player The optional player used to determine max width
     */
    columnText(list: string | string[], width?: number, player?: MUDObject): string;

    /**
     * Transfer the connected player to a new body object
     * @param oldBody
     * @param newBody
     * @param callback
     */
    exec(oldBody: MUDObject, newBody: MUDObject, callback: (oldBody: MUDObject, newBody: MUDObject) => void): boolean;

    fs: MUDFileSystemEfuns
}

declare const efuns: EFUNProxy;
