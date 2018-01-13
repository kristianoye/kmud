/**
 * A MUD filesystem.
 */
declare class FileSystem {
    /**
     * Associates the filesystem with its security manager.
     * @param manager
     */
    addSecurityManager(manager: FileSecurity): void;

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

}

let FT_FILE = 1;
let FT_DIRECTORY = 2;