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
}

declare interface GameServer {
    /** Get the execution context */
    getExecution(): ExecutionContext;
}

const driver: GameServer;