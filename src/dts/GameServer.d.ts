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

declare class ExecutionContext {
    /** Create a related child context.  This context must complete before its parent is finished */
    fork(): ExecutionContext;

    /** Create a related child context.  This context must complete before its parent is finished 
     * @param {boolean} isAsync Whether or not this is an async method call.
     */
    fork(isAsync: boolean): ExecutionContext;

    /** Indicates the context was created for an async call. */
    readonly async: boolean;

    getFrame(index: number): ExecutionFrame;

    /**
     * Perform security checks based on the current stack.
     * @param check
     */
    guarded(check: (frame: ExecutionFrame) => boolean): boolean;

    //  Indicate the current execution frame is complete.
    pop(): ExecutionContext;

    //  Push a new frame on to the stack
    push(ob: MUDObject, method: string, filename: string): ExecutionContext;

    readonly thisObject: MUDObject;

    readonly thisPlayer: MUDObject;

    readonly truePlayer: MUDObject;
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

    /**
     * Sets the active player.
     * @param player The player returned by thisPlayer
     */
    setThisPlayer(player: MUDObject): MXC;
    setThisPlayer(player: MUDObject, truePlayer: MUDObject): MXC;
    setThisPlayer(player: MUDObject, truePlayer: MUDObject, verb: string): MXC;

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
