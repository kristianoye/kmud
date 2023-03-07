/**
 * The base of all in-game objects
 */
declare interface MUDObject {
    /** Attempt to destroy the object */
    destructAsync(): Promise<boolean>;

    /** Is the object being garbage-collected? */
    readonly destructed: boolean;

    /** The directory in which the source for this object lives */
    readonly directory: string;

    /** The environment in which this object resides (if any) */
    readonly environment: MUDObject;

    /** The filename of the object */
    readonly filename: string;

    /** A collection of objects desiding within this object */
    readonly inventory: MUDObject[];

    /** True if the object does not reside in a file-based module */
    readonly isVirtual: boolean;

    /**
     * Attempt to move this object into another object 
     * @param destination The environment into which to move
     */
    moveObjectAsync(destination: MUDObject): Promise<boolean>;

    /**
     * Returns a wrapper method that avoids incrementing the object ref count 
     */
    readonly wrapper: () => MUDObject;
}

declare interface FileManager {
    createFileQuery(options: FileSystemQuery): FileSystemQuery;

    /**
     * Determine if the absolute path is a mount point
     * @param directory The path expression to check
     */
    isMountPoint(directory: string): boolean;

    /**
     * Query the filesystem
     * @param query The criteria to search for
     * @param isSystemRequest Is this a system request?  This bypasses security
     */
    queryFileSystemAsync(query: FileSystemQuery, isSystemRequest?: boolean): Promise<FileSystemObject[]>;
}

declare interface MUDFileSystem {
    /**
     * Query the filesystem
     * @param query The criteria to search for
     * @param isSystemRequest Is this a system request?  This bypasses security
     */
    queryFileSystemAsync(query: FileSystemQuery): Promise<FileSystemObject[]>;

    /**
     * Attempt to fetch a single file object from the filesystem
     * @param query
     */
    statAsync(query: FileSystemQuery): Promise<FileSystemObject>;
}

/** Base file system object */
declare interface FileSystemObject {
    /** The access timestamp */
    atime: Date;

    /** The actual date the file was created */
    birthtime: Date;

    /** The birthday represented in miliseconds */
    birthtimeMs: number;

    /** The number of blocks consumed by this file object */
    blocks: number;

    /** The size of a single block on the device (if it is a block device) */
    blockSize: number;

    /** The content from the object (if requested) */
    content: string | object;

    /** The creation time */
    ctime: Date;

    /** The creation time represented in miliseconds */
    ctimeMs: number;

    /** Default file encoding */
    defaultEncoding: string;

    /** The default MUD group for this object */
    defaultGroup: string;

    /** The device ID on which this object exists */
    dev: number;

    /** Does the specified object exist on the filesystem */
    exists: boolean;

    /** The group ID */
    gid: number;

    /** The inode--generally not used */
    ino: number;

    /** Is the object a block device? */
    isBlockDevice: boolean;

    /** Is the object a character device? */
    isCharacterDevice: boolean;

    /** Indicates whether the entry is a directory */
    isDirectory: boolean;

    /** Is the object a First-In, First-Out pipe? */
    isFIFO: boolean;

    /** Indicates whether the entry is a regular file */
    isFile: boolean;

    /** Is the item a socket? */
    isSocket: boolean;

    /** Is the object a link? */
    isSymbolicLink: boolean;

    /** The modify time */
    mtime: Date;

    /** The modify time in miliseconds */
    mtimeMs: number;

    /** The name of the file object */
    name: string;

    /** Number of hard links to this file */
    nlink: number;

    /** The file owner */
    owner: string;

    /** The parent file object */
    parent: FileSystemObject;

    /** The full MUD file path to this item */
    path: string;

    /** Path relative to the root of the filesystem */
    relativePath: string;

    /** The size of the file object in bytes (-1 = does not exist, -2 = directory) */
    size: number;

    /** The user Id who owns the file */
    uid: number;

    deleteAsync(flags: number): Promise<boolean>;

    getParent(): Promise<FileSystemObject>;

    readAsync(): string | string[] | FileSystemObject[];

    /** Refresh information about the object */
    refreshAsync(): Promise<boolean>;
}

/** Contains criteria for querying the filesystem */
declare interface FileSystemQuery {
    readonly absolutePath: string;

    /** Determine if we want to prevent going any deeper into the hierarchy */
    readonly atMaxDepth: boolean;

    clone(query: FileSystemQuery): FileSystemQuery;

    /** The pattern to look for */
    expression: string | RegExp;

    /** Is it okay to cross filesystems? */
    crossFilesystem: boolean;

    /** A literal string to look for within files */
    contains: string | false;

    /** A regular expression to look for within files */
    containsPattern: string | RegExp | false;

    /** Does the expression contain wildcards? */
    containsWildcard: boolean;

    /** A reference to the FileManager */
    fileManager: FileManager;

    /** The filesystem to search on */
    fileSystem: MUDFileSystem;

    fileSystemId: string;

    flags: number;

    /**
     * Determine if the specified bitflag is set
     * @param flag
     */
    hasFlag(flag: number): boolean;

    /** Does the query contain a globstar expression? */
    isGlobalstar: boolean;

    /** Is this query a system request? */
    readonly isSystemRequest: boolean;

    /** Maximum create date */
    maxCreateDate: Date;

    /** The max directory depth */
    maxDepth: number;

    /** Maximum modify date */
    maxModifyDate: Date;

    /** Minimum create date */
    minCreateDate: Date;

    /** Minimum modify date */
    minModifyDate: Date;

    /** Current depth in the filesystem */
    readonly queryDepth: number;

    /** Path relative to the root of this filesystem */
    readonly relativePath: string;
}

/** The central game object */
declare interface GameServer {
    /**
     * Strips a stack trace of external filename references
     * @param error The exception to clean
     * @param showExternal If true then external frames from the driver and modules are included on stack.
     */
    cleanError(error: Error, showExternal: boolean): void;

    /** Initialize the filesystem objects */
    createFileSystems(): void;

    /**
     * Make a call as the driver
     * @param method The name of the method being called
     * @param callback The callback to execute with the driver on the stack
     * @param filename Optional filename to include in the context stack
     * @param rethrow If true then exceptions are rethrown instead of swalloed
     * @param newContext If true then a new context is created and old one is restored when call is complete
     * @returns Result of the callback function
     */
    driverCallAsync(method: string, callback: () => any, filename?: string, rethrow?: boolean, newContext?: boolean): any;

    readonly fileManager: FileManager;
}

declare const driver: GameServer;

