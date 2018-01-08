declare class FileSecurity {
    denied(verb: string, expr: string): false;
    denied(verb: string, expr: string, callback: (success: false, err: string) => false): false;

    /** A stored reference to the game server instance */
    driver: GameServer;

    /**
     *  Determine if the object(s) contained within the file belong in a group.
     * @param filename The file to get permissions for.
     * @param groupList A list of one or more groups to search.
     */
    inGroup(filename: string, ...groupList: string[]): boolean;

    /**
     *  Determine if the specified object is within the specified security group.
     * @param target
     */
    inGroup(target: MUDObject, ...groupList: string[]): boolean;

    /** If true then failed security attempts throw hard exceptions */
    throwSecurityExceptions: boolean;

    /**
     * Determine if the caller has permission to unlink a file.
     * @param efuns The object making the delete request.
     * @param mudpath The path to unlink from the filesystme.
     */
    validDeleteFile(efuns: EFUNProxy, mudpath: string): boolean;

    /**
     * Determine if the caller should be allowed to load an object.
     * @param efuns The object making the load request.
     * @param mudpath The path to the object being requested.
     */
    validLoadObject(efuns: EFUNProxy, mudpath: string): boolean;

    /**
     * Determine if the caller can list files in the specified directory.
     * @param efun The object making the read request.
     * @param mudpath The path expression to evaluate.
     */
    validReadDirectory(efun: EFUNProxy, mudpath: string): boolean;

    /**
     * Determines if a call to read a file should be allowed.
     * @param efuns The object making the request.
     * @param mudpath The absolute MUD path being read.
     */
    validReadFile(efuns: EFUNProxy, mudpath: string): boolean;

    /**
     * Determines if a call to write a file should be allowed.
     * @param efuns The object making the request.
     * @param mudpath The absolute MUD path being read.
     */
    validWriteFile(efuns, EFUNProxy, mudpath: string): boolean;
}
