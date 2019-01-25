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
    compiler: MUDCompiler;

    /** Current runtime configuration */
    config: MUDConfig;

    /** The current execution context */
    currentContext: MXC;

    /** The current verb */
    currentVerb: string;

    /** Special instance of efuns for driver */
    efuns: EFUNProxy;

    /** The MUD filesystem */
    fileManager: FileManager;

    /**
     * Returns the current execution context.
     */
    getContext(): MXC;

    /**
     * Indicates whether to create a new context or not.
     * @param createNew
     */
    getContext(createNew: boolean): MXC;

    /**
     * Create a new context and initialize it.
     * @param createNew
     * @param initializer
     */
    getContext(createNew: boolean, initializer: (context: MXC) => void): MXC;

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
