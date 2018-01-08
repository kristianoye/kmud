/// <reference path="FileSecurity.d.ts"/>
/// <reference path="MUDCache.d.ts"/>
/// <reference path="MUDLoader.d.ts"/>
/// <reference path="MasterObject.d.ts"/>

declare class GameServer {
    /** The in-game master called when an error occurs */
    applyErrorHandler: function(Error, boolean) | false;

    applyGetPreloads: false | function(): string[];

    /** Information about the currently loaded game objects */
    cache: MUDCache;

    /** In-game compiler */
    compiler: MUDCompiler;

    /** Special instance of efuns for driver */
    efuns: EFUNProxy;

    /** The MUD filesystem */
    fileManager: FileManager;

    /** This value indicates whether the game is starting, running, or shutting down */
    gameState: number;

    /** The number of heartbeats since the last server start */
    heartbeatCounter: number;

    /** The number of milliseconds between heartbeat calls */
    heartbeatInterval: number;

    /** A list of directories to search for include files */
    includePath: string[];

    /** The directory to which log files are written */
    logDirectory: string;

    /** The in-game master object */
    masterObject: MasterObject;

    /** The players that have connected to the game */
    players: MUDObject[];

    /** The server address that is used for outgoing TCP connections */
    serverAddress: string;

    /** The container in which all objects store their data */
    storage: MUDStorageContainer;

    /**
     * Adds a player to the list of active players.
     * @param body The newly connected player.
     */
    addPlayer(body: MUDObject): void;

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
