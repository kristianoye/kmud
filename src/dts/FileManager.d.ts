
declare enum GetDirFlags {
    /** Return files in the result set */
    Files = 1 << 1,

    /** Return subdirectories in the result set */
    Dirs = 1 << 2,

    /** Return permissions for each item in the result */
    Perms = 1 << 3,

    /** Include hidden system files in the result */
    System = 1 << 4,

    /** Include file size information in the result */
    Size = 1 << 0
}

declare enum MkdirFlags {
    /** If set then mkdir() will try and create the entire directory struct.
      Any missing or incomplete part will be created and no errors will be
      generated even if the entire path already exists. */
    EnsurePath = 1
}

declare enum StatFlags {
    /** No additional flags requested. */
    None = 0,

    /** Retrieve file size information. */
    Size = 1 << 0,

    /** Fetch the permissions from security manager */
    Perms = 1 << 1,

    /** Return the parent(s) object stat in the result */
    Parent = 1 << 2,
}

declare class FileStat {
    /** Indicates whether the path exists. */
    readonly exists: boolean;

    /** Indicates whether the path is a directory. */
    readonly isDirectory: boolean;

    /** Indicates whether the path is a regular file. */
    readonly isFile: boolean;

    /** Indicates the file size in bytes. */
    readonly fileSize: number;

    /** The parent object, if any, and only if requested */
    readonly parent: FileStat;
}

declare class MkDirOptions {
    /** Optional flags for creating the directory */
    flags: MkdirFlags;
}


declare class FileManager {
    /** A reference to the game server/driver */
    readonly driver: GameServer;

    /**
     * Creates a directory on the filesystem.
     * @param efuns The caller requesting the new directory.
     * @param expr The path expression to create.
     * @param opts Extra information used to create the directory.
     * @param callback An optional callback for async mode.
     */
    createDirectory(efuns: EFUNProxy, expr: string, opts: MkDirOptions, callback: (success: boolean, err: Error) => void): boolean;

    /**
     * Removes a directory from the filesystem.
     * @param efuns The caller requesting to remove the directory.
     * @param expr The path expression to remove.
     * @param opts Extra information (currently unused)
     * @param callback An optional callback for async mode.
     */
    deleteDirectory(efuns: EFUNProxy, expr: string, opts: any, callback: (success: boolean, err: Error) => void): boolean;

    /**
     * Load an object syncronously.
     * @param efuns The object loading the object.
     * @param expr The filepath expression to load.
     * @param args Optional constructor args for the new object.
     */
    loadObject(efuns: EFUNProxy, expr: string): MUDObject;

    /**
     * Load an object syncronously.
     * @param efuns The object loading the object.
     * @param expr The filepath expression to load.
     * @param args Optional constructor args for the new object.
     */
    loadObject(efuns: EFUNProxy, expr: string, args: object): MUDObject;

    /**
     * Load an object asyncronously.
     * @param efuns The object loading the object.
     * @param expr The filepath expression to load.
     * @param callback An asyncronous callback that fires when the load is complete.
     */
    loadObject(efuns: EFUNProxy, expr: string, callback: (result: MUDObject, err: Error) => void): void;

    /**
     * Load an object asyncronously.
     * @param efuns The object loading the object.
     * @param expr The filepath expression to load.
     * @param args Optional constructor args for the new object.
     * @param callback An asyncronous callback that fires when the load is complete.
     */
    loadObject(efuns: EFUNProxy, expr: string, args: object, callback: (result: MUDObject, err: Error) => void): void;

    /**
     * Read directory table from disk.
     * @param efuns The object requesting the listing.
     * @param expr The filepath expression to query (may contain wildcards)
     * @param flags Flags requesting additional information in the results.
     * @param callback
     */
    readDirectory(efuns: EFUNProxy, expr: string, flags: number, callback: (files: string[], err: Error) => void): void;

    /**
     * Read a file from external storage.
     * @param efuns The proxy making the read request.
     * @param expr The file expression to read.
     * @param callback An optional callback for async operation.
     */
    readFile(efuns: EFUNProxy, expr: string, callback: (content: string, err: Error) => void): void;

    /**
     * Read structured data from external storage.
     * @param efuns The proxy making the read request.
     * @param expr The file expression to read.
     * @param callback An optional callback for async operation.
     */
    readJsonFile(efuns: EFUNProxy, expr: string, callback: (content: any, err: Error) => void): void;

    /**
     * Returns data about the specified filepath.
     * @param efuns The proxy requesting the file stat.
     * @param filePath The file expression to evaluate.
     * @param flags Request for additional file information.
     * @param callback A callback to execute when the stat operation is complete.
     */
    stat(efuns: EFUNProxy, filePath: string, flags: number, callback: (stat: FileStat, err: Error) => void): void;

    /**
     * Translates an absolute filesystem path to a MUD virtual path.
     * @param expr The external filesystem path to translate.
     */
    toMudPath(expr: string): string;

    /**
     * Translates a virtual MUD path into an external filesystem path.
     * @param expr
     */
    toRealPath(expr: string): string;

    /**
     * Write data to a disk file, overwriting any existing file.
     * @param efuns The proxy making the write request.
     * @param expr The file expression to write to.
     * @param content The content to write to the file.
     * @param callback An optional callback for async mode.
     */
    writeFile(efuns: EFUNProxy, expr: string, content: string, callback: (err: Error|false) => void): void;
}