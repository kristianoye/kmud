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

    /**
     * Checks to see if the expression is a directory.
     * @param efuns The object checking the directory.
     * @param req The file system request containing the path being checked.
     * @param callback An optional callback to receive the result.
     */
    isDirectory(efuns: EFUNProxy, req: FileSystemRequest, callback: (isDir: boolean, err: Error) => void): boolean;

    /**
     * Checks to see if the expression is a file.
     * @param efuns The object checking the file.
     * @param req The file system request containing the path being checked.
     * @param callback An optional callback to receive the result.
     */
    isFile(efuns: EFUNProxy, req: FileSystemRequest, callback: (isFile: boolean, err: Error) => void): boolean;

    /**
     * Read contents from a directory in the filesystem.
     * @param efuns
     * @param req
     * @param callback
     */
    readDirectory(efuns: EFUNProxy, req: FileSystemRequest, callback: (results: any[], err: Error) => void): any[];

    /**
     * Read a file from the filesystem.
     * @param efuns
     * @param req
     * @param callback
     */
    readFile(efuns: EFUNProxy, req: FileSystemRequest, callback: (content: string, err: Error) => void): string;

    /** If true then failed security attempts throw hard exceptions */
    throwSecurityExceptions: boolean;

    /**
     * Determine whether the caller is allowed to create a directory.
     * @param efuns The object attempting to create a directory.
     * @param req The directory being created.
     */
    validCreateDirectory(efuns: EFUNProxy, req: FileSystemRequest): boolean;

    /**
     * Determine if the caller has permission to unlink a directory.
     * @param efuns The object making the delete request.
     * @param req The path to unlink from the filesystme.
     */
    validDeleteDirectory(efuns: EFUNProxy, req: FileSystemRequest): boolean;
    
    /**
     * Determine if the caller has permission to unlink a file.
     * @param efuns The object making the delete request.
     * @param req The path to unlink from the filesystme.
     */
    validDeleteFile(efuns: EFUNProxy, req: FileSystemRequest): boolean;

    /**
     * Determine if the caller should be allowed to load an object.
     * @param efuns The object making the load request.
     * @param req The path to the object being requested.
     */
    validLoadObject(efuns: EFUNProxy, req: FileSystemRequest): boolean;

    /**
     * Determine if the caller can list files in the specified directory.
     * @param efun The object making the read request.
     * @param req The path expression to evaluate.
     */
    validReadDirectory(efun: EFUNProxy, req: FileSystemRequest): boolean;

    /**
     * Determines if a call to read a file should be allowed.
     * @param efuns The object making the request.
     * @param req The absolute MUD path being read.
     */
    validReadFile(efuns: EFUNProxy, req: FileSystemRequest): boolean;

    /**
     * Determines if a call to write a file should be allowed.
     * @param efuns The object making the request.
     * @param req The absolute MUD path being read.
     */
    validWriteFile(efuns, EFUNProxy, req: FileSystemRequest): boolean;
}
