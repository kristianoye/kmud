declare interface CreationContext {
    /** Arguments for the constructor */
    readonly args: any[];

    /** The object filename */
    readonly filename: string;

    /** The unique instance ID */
    readonly instanceId: string | number;

    /** Is this a virtual object? */
    readonly isVirtual: boolean;
}

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
    /**
     * Add a creation context to the stack during object creation
     * @param ctx
     */
    addCreationContext(ctx: CreationContext): CreationContext;

    /**
     * Add a virtual creation context to the stack during object creation
     * @param ctx
     */
    addVirtualCreationContext(ctx: CreationContext): CreationContext;

    /** Check to see if the current context has exceeded its execution limit */
    alarm(): ExecutionContext;

    /**
     * Check to see if the caller has access to the current method
     * @param thisObject The object (caller)
     * @param access The access level required
     * @param method The method being called
     * @param fileName The filename being called
     */
    assertAccess(thisObject: MUDObject, access: AccessType, method: string, fileName: string): boolean;

    /** Completes the context */
    complete(): ExecutionContext;

    /** Get the filename of the current frame */
    getCurrentFilename(): string;

    /**
     * Get shell options for the specified verb
     * @param verb
     */
    getShellOptionsAsync(verb?: string): Promise<CommandShellOptions>;

    /**
     * Creates a child context
     * @param detached Normally the child is attached to its parent; If true then the child context has no parent
     */
    fork(detached: boolean): ExecutionContext;

    /**
     * Check access to a guarded function
     * @param check The callback that performs the check; A return of false makes the whole call fail
     * @param action An optional action to execute if the check passes
     * @param rethrow If an exception is thrown should it be rethrown up the stack?
     */
    guarded(check: (frame: ObjectStackItem) => boolean, action?: () => any, rethrow?: boolean): boolean;

    /**
     * Pops an execution frame off the stack and compares it to the expected method
     * @param method The method that should be expected on the top of the stack
     */
    pop(method: string);

    popCreationContext(): CreationContext;

    /** Returns the previous object */
    previousObject(): MUDObject;

    /** Get all previous objects from the stack */
    previousObjects(): MUDObject[];

    /**
     * Push a new execution frame on to the stack
     * @param object The object (or module) that is executing
     * @param method The method being called
     * @param file The file in which the call is being made
     * @param isAsync Is the call an async method?
     * @param lineNumber The line number from which the call is being made
     * @param callString
     */
    push(object: MUDObject | string, method: string, file: string, isAsync?: boolean, lineNumber?: number, callString?: string);

    /** Restore the context */
    restore(): ExecutionContext;

    /** Suspend the current context */
    suspend(): ExecutionContext;

    /** The object that is currently executing */
    thisObject(): MUDObject;

    /**
     * A callback to execute when the context finishes executing
     * @param callback The code to run when complete
     */
    whenComplete(callback: (context: ExecutionContext) => void): ExecutionContext;

    /**
     * Execute a frame using a particular player object as "this player"
     * @param store The player object or player object store
     * @param callback The callback to fire
     * @param restoreOldPlayer If true then the previous player becomes this player again
     * @param methodName The name of the method being executed
     */
    withPlayer(store: MUDStorage | MUDObject, callback: (player: MUDObject) => any, restoreOldPlayer: boolean, methodName: string | false): any;

    /**
     * Execute a frame using a particular player object as "this player"
     * @param store The player object or player object store
     * @param callback The callback to fire
     * @param restoreOldPlayer If true then the previous player becomes this player again
     * @param methodName The name of the method being executed
     */
    withPlayerAsync(store: MUDStorage | MUDObject, callback: (player: MUDObject) => any, restoreOldPlayer: boolean, methodName: string | false): any;
}
