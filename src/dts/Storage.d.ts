declare interface ActionBinder {
    /**
     * Bind an action from the player's inventory.
     */
    bindAction(verb: string, target: MUDObject, callback: (text: string, evt: MUDInputEvent) => number): ActionBinder; 

    /**
     * Try and execute a command as action.
     */
    tryAction(evt: MUDInputEvent): Promise<number>;

    /**
     * Unbind all actions associated with the specified object.
     */
    unbindActions(item: MUDObject): ActionBinder;
}

declare interface MUDStorage {
    // #region Events

    /**
     * Currently bound actions
     */
    actionBinder: ActionBinder;

    /**
     * Dispatches a command from the connected client to the attached body object
     * @param clientCommand The command to execute
     */
    eventCommand(clientCommand: ClientCommand): Promise<any>;

    /** Destroys the object and prepares it for Garbage Collection */
    eventDestroy(...args: any[]): boolean;

    /**
     * Perform a body switch
     * @param component The client object connecting to this body.
     * @param args Arguments to pass to the connect() and disconnect() applies
     */
    eventExec(component: ClientComponent, ...args: any[]): Promise<boolean>;

    /**
     * Called periodically by the driver if this object is "alive".
     * @param total The total number of heartbeats since the object became alive
     * @param ticks The total number of ticks since the last heartbeat
     */
    eventHeartbeat(total: number, ticks: number): void;

    /** Called to perform initialization tasks (e.g. get permissions, etc) */
    eventInitialize(): Promise<boolean>;

    /**
     * Restores data into the storage
     * @param data
     */
    eventRestore(data: any): MUDObject;

    /**
     * Send an event to the client
     * @param event
     */
    eventSend(event: MUDEvent): Promise<boolean>;

    // #endregion

    // #region Properties 

    /** Is there an active client connected? */
    connected: boolean;

    /** Has the object been destroyed/de-allocated?  Ready for GC? */
    destroyed: boolean;

    /** A reference to the object's current environment */
    environment: MUDObject;

    /** Does the object have a heartbeat? */
    heartbeat: boolean;

    /** How many ms has this interactive object been idle? */
    idleTime: number;

    /** Is the object or HAS the object been interactive? */
    interactive: boolean;

    /** What objects are contained within this object? */
    inventory: MUDObject[];

    /** Is the object alive? */
    living: boolean;

    /** How long can this object remain idle before it is disconnected? */
    maxIdleTime: number;

    /** Is the object mortal? */
    player: boolean;

    /** Get a direct reference to the object this storage maintains state for */
    thisObject: MUDObject;

    /** Is this a wizard/creator player? */
    wizard: boolean;

    // #endregion

    // #region Methods

    /**
     * Fetch a value from storage
     * @param definingType The type in ths object's inheritance hierarchy defining the property
     * @param propertyName The property name
     * @param initialValue The initial value of the property if not already set (initializer)
     */
    get(definingType: string, propertyName: string, initialValue?: any): any;

    /** Returns what the remote client is capable of */
    getClientCaps(): MUDClientCaps;

    /**
     * If an object is recompiled then this method gets executed to re-associate the target object
     * @param owner
     */
    reload(owner): MUDStorage;

    /**
     * Set a value in storage
     * @param definingType The path to the module setting the value
     * @param propertyName The property to set
     * @param value The value of the property
     */
    set(definingType: string, propertyName: string, value: any): boolean;

    // #endregion
}

declare interface MUDStorageContainer {
    /**
     * Create a new storage object for the specified game object
     * @param target
     */
    create(target: MUDStorage | string): MUDStorage;

    /**
     * Deletes a storage object when it is no longer needed.
     * @param target
     */
    delete(target: MUDStorage | string): boolean;

    /**
     * Global container for all storage objects
     * @param target
     */
    get(target: MUDObject | string): MUDStorage;
}