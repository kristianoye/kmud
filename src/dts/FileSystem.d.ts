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

}

let FT_FILE = 1;
let FT_DIRECTORY = 2;