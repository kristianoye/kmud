/// <reference path="FileSecurity.d.ts"/>
/// <reference path="MUDCache.d.ts"/>
/// <reference path="MUDLoader.d.ts"/>
/// <reference path="MasterObject.d.ts"/>
/// <reference path="MUDConfig.d.ts" />

declare class MUDGlobals {
    /**
     * Transfer the collected globals to the MUDLoader object.
     * @param loader
     */
    modifyLoader(loader: MUDLoader): void;
}

let mudglobal = new MUDGlobals;

declare class MUDObjectStack {
    /** The object reference */
    object: MUDObject;

    /** The name of the file the object was created from */
    file: string;

    /** The name of the method from the stack */
    func: string;
}

declare class ExecutionFrame {
    readonly file: string;

    readonly isAsync: boolean;

    readonly lineNumber: number;

    readonly method: string;

    readonly object: MUDObject | false;
}

declare class StandardWriteableStream {
    /**
     * Called to fetch the content of the buffer
     * @param encoding
     */
    getBuffer(encoding = false): Buffer;

    /**
     * Write text to the stream
     * @param text
     * @param encoding
     */
    write(text: string, encoding = 'utf8'): number;

    /**
     * Write text with an EOL character to the stream.
     * @param text
     * @param encoding
     */
    writeLine(text: string, encoding = 'utf8'): number;
}

declare class ExecutionContext {
    /** Indicates the context was created for an async call. */
    readonly async: boolean;

    /** Indicate the current execution context has completed */
    complete(): ExecutionContext;

    /** Creates a new child context to be associated with an async call */
    fork(): ExecutionContext;

    getFrame(index: number): ExecutionFrame;

    /**
     * Perform security checks based on the current stack.
     * @param check
     */
    guarded(check: (frame: ExecutionFrame) => boolean): boolean;

    /** 
     * Indicate the current execution frame is complete. 
     * @param method The name of the method popping off the stack
     */
    pop(method: string): ExecutionContext;

    /** Push a new frame on to the stack */
    push(ob: MUDObject, method: string, filename: string): ExecutionContext;

    /** Previous objects on the stack; Starting with "thisObject" */
    readonly previousObjects: MUDObject[];

    /** Restore the context so that it is the active context in the driver. */
    restore(): ExecutionContext;

    readonly stderr: StandardWriteableStream;

    readonly stdin: ReadableStream;

    readonly stdout: StandardWriteableStream;

    readonly thisClient: MUDClient;

    readonly thisObject: MUDObject;

    readonly thisPlayer: MUDObject;

    readonly truePlayer: MUDObject;

    /**
     * Creates a wrapper around an asyncronous call
     * @param code The code to wrap
     * @param timeout The maximum amount of time to wait for call to return
     */
    static asyncWrapper(asyncCode: (resolve: (any) => void, reject: (any) => void) => void, timeout: number = 5000): Promise<T>;
}

declare class GameServer {
    /**
     * Adds a "living" object to the game.
     * @param body
     */
    addLiving(body: MUDObject): void;

    /**
     * Adds a player to the list of active players.
     * @param body The newly connected player.
     */
    addPlayer(body: MUDObject): void;

    /** The in-game master called when an error occurs */
    applyErrorHandler: ((Error, boolean) => void) | false;

    applyGetPreloads: false | (() => string[]);

    /** Information about the currently loaded game objects */
    cache: MUDCache;

    /**
     * Strips out potentially private path information.
     * @param err
     */
    cleanError(err: Error): Error;

    /** In-game compiler */
    compiler: MUDCompiler;That

    /** Current runtime configuration */
    config: MUDConfig;

    /** The current execution context */
    currentContext: MXC;

    /** The current verb */
    currentVerb: string;

    driverCall(method: string, callback: (ecc: ExecutionContext) => any, filename: string = '', rethrow: boolean = false): any;

    /** Special instance of efuns for driver */
    efuns: EFUNProxy;

    /** The MUD filesystem */
    fileManager: FileManager;

    /** Get the execution context */
    getExecution(): ExecutionContext;

    /**
     * Get the execution context, add a new frame, and return the context.
     * @param ob The object being added to the stack.
     * @param method The method being called.
     * @param file The file in which the method exists.
     */
    getExecution(ob: MUDObject, method: string, file: string, isAsync: boolean, line: number): ExecutionContext;

    /**
     * Fetch the current object stack.
     */
    getObjectStack(): MUDObjectStack[];

    /** This value indicates whether the game is starting, running, or shutting down */
    gameState: number;

    /** The number of heartbeats since the last server start */
    heartbeatCounter: number;

    /** The number of milliseconds between heartbeat calls */
    heartbeatInterval: number;

    /** Objects with heartbeats */
    heartbeatObjects: MUDObject[];

    heartbeatStorage: Map<number, MUDStorage>;

    /** A list of directories to search for include files */
    includePath: string[];

    /** The directory to which log files are written */
    logDirectory: string;

    /** Writes to the system log */
    logger: MUDLogger;

    /** The in-game master object */
    masterObject: MasterObject;

    /** The players that have connected to the game */
    players: MUDObject[];

    /**
     *  Removes a living object from the game.
     * @param living
     */
    removeLiving(living: MUDObject): boolean;

    /**
     * Removes a player from the list of active players.
     * @param player
     */
    removePlayer(player: MUDObject): boolean;

    /**
     * Restore another context.
     * @param context The context that was previously executing.
     */
    restoreContext(context: MXC): MXC;

    /** The server address that is used for outgoing TCP connections */
    serverAddress: string;

    /** The container in which all objects store their data */
    storage: MUDStorageContainer;

    /**
     * Called at startup, this method creates the in-game master object.
     */
    createMasterObject(): void;

    /**
     * Gets a reference to the GameServer singleton.
     */
    static get(): GameServer;
}

let driver = new GameServer;
