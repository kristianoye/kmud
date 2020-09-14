
declare enum AccessType {
    Public = 'public',

    Protected = 'protected',

    Private = 'private'
}

declare interface GameServer {
    /** The module cache */
    cache: MUDCache;

    /**
     * Make a method call with the driver at the top of the stack
     * @param method The method that will appear in any stack trace
     * @param callback The code to execute once the driver is on the stack
     */
    driverCall(method: string, callback: (ecc: ExecutionContext) => any): any;

    /**
     * Make a method call with the driver at the top of the stack
     * @param method The method that will appear in any stack trace
     * @param callback The code to execute once the driver is on the stack
     */
    driverCallAsync(method: string, callback: (ecc: ExecutionContext) => Promise<any>): Promise<any>;

    /** Driver's instance of the efun object */
    readonly efuns: EFUNProxy;

    /** The file manager object */
    fileManager: FileManager;

    /** Get the execution context */
    getExecution(): ExecutionContext;

    /** The global storage objects */
    storage: MUDStorageContainer;

}

declare const driver: GameServer;