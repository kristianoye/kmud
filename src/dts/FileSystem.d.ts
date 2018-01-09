
declare class FileSystem {
    addSecurityManager(manager: FileSecurity): void;

    readFile(expr: string): string;
    readFile(expr: string, callback: (content: string, err: Error) => void): void;

    readJsonFile(expr: string): any;
    readJsonFile(expr: string, callback: (content: any, err: Error) => void): void;
}