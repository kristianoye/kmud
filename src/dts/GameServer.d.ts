declare interface ObjectStackItem {
    /** The file the object lives in */
    file: string;

    /** Is the call asynchronous? */
    isAsync?: boolean;

    /** The method executing in the object */
    method: string;

    /** A reference to the object */
    object: object;
}

declare interface ExecutionContext {
    guarded(check: (frame: ObjectStackItem) => boolean): boolean;

    withPlayerAsync(store: MUDStorage, callback: (player: MUDObject) => any, restoreOldPlayer: boolean, methodName: string | false): any;
}

declare interface GameServer {
    /** Get the execution context */
    getExecution(): ExecutionContext;
}

declare const driver: GameServer;