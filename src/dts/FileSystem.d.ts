declare class FileSystemStat {
    /** The last time the file was accessed */
    readonly atime: Date;

    /** The device block size */
    readonly blockSize: number;

    /** The number of blocks allocated for this file */
    readonly blocks: number;

    /** The last time file permissions changed */
    readonly ctime: Date; 

    /** The device number */
    readonly dev: number;

    /** Indicates whether the path exists. */
    readonly exists: boolean;

    /** Indicates whether the path is a directory. */
    readonly isDirectory: boolean;

    /** Indicates whether the path is a regular file. */
    readonly isFile: boolean;

    /** The last time the file was modified */
    readonly mtime: Date;

    /** Indicates the file size in bytes. */
    readonly size: number;

    /** The parent object, if any, and only if requested */
    readonly parent: FileSystemStat;
}

/**
 * A MUD filesystem.
 */
declare class FileSystem {
    /**
     * Associates the filesystem with its security manager.
     * @param manager
     */
    addSecurityManager(manager: FileSecurity): void;

    appendFile(expr: string, content: string): boolean;
    appendFile(expr: string, content: string, callback: (success: boolean, error: Error) => void): void;

    /**
     * 
     * @param expr
     * @param args
     */
    cloneObject(expr: string, args: any): MUDObject;

    /**
     * Clone an object asyncronously.
     * @param expr
     * @param args
     * @param callback
     */
    cloneObject(expr: string, args: any, callback: (clone: MUDObject, error: Error) => void): void;

    /**
     * Checks to see if the expression is a directory.
     * @param req The path being evaluated.
     * @param callback An optional callback to receive the result.
     */
    isDirectory(req: FileSystemRequest, callback: (isDir: boolean, err: Error) => void): boolean;

    /**
     * Checks to see if the expression is a file.
     * @param req The path being evaluated.
     * @param callback An optional callback to receive the result.
     */
    isFile(req: FileSystemRequest, callback: (isFile: boolean, err: Error) => void): boolean;

    /**
     * Reads contents from a directory
     * @param req The path being read
     * @param callback A callback used for asyncronous mode.
     */
    readDirectory(req: FileSystemRequest,  callback: (content: any[], err: Error) => void): any[];

    /**
     * Reads a file from the storage layer.
     * @param expr The file to read from.
     */
    readFile(expr: string): string;
    /**
     * Reads a file from the storage layer.
     * @param expr The file to read from.
     * @param callback The callback to execute when the read is complete.
     */
    readFile(expr: string, callback: (content: string, err: Error) => void): void;

    readJsonFile(expr: string): any;
    readJsonFile(expr: string, callback: (content: any, err: Error) => void): void;

    stat(expr: string, flags: number): FileSystemStat;
    stat(expr: string, flags: number, callback: (stats: FileSystemStat, error: Error) => void): void;

    writeFile(expr: string, content: string): boolean;
    writeFile(expr: string, content: string, callback: (success: boolean, error: Error) => void): void;

}

let FT_FILE = 1;
let FT_DIRECTORY = 2;