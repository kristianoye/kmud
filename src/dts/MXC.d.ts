declare class MXCFrame {
    /** The name of the file the calling object is defined in */
    readonly file: string;

    /** The name of the function making the call */
    readonly func: string;

    /** The object instance making the call */
    readonly object: MUDObject;
}

declare class MXC {
    /**
     * Aborts a context, requesting all operations to cancel.
     */
    abort(): MXC;

    /**
     * Indicates if the context has been aborted.
     */
    readonly aborted: boolean;

    /**
     * Creates a frame on the object stack.
     * @param frame
     */
    addFrame(frame: ...MXCFrame[]): MXC;

    /**
     * Adds an object to the LIFO object stack.
     * @param ob The new object on the frame.
     * @param method The method name from the callstack.
     */
    addObject(ob: MUDObject, method: string): MXC;

    /**
     * The time at which execution should die; false indicates unlimited.
     */
    alarm: number;

    /**
     * Clones the context and adds to the stack.
     */
    clone(): MXC;

    /**
     * Clones the current context and allows for an initializer.
     * @param init An optional initializer to customize the context.
     */
    clone(init: (newCtx: MXC) => MXC): MXC;

    /**
     * Clones the current context and allows for an initializer.
     * @param init An optional initializer to customize the context.
     * @param note A note describing what the context is for.
     */
    clone(init: (newCtx: MXC) => MXC, note: string);

    /** The unique context ID */
    contextId: number;

    /**
     * Adds any additional frames to the context's object stack.
     */
    join(): MXC;

    /** The number of items in the object stack */
    readonly length: number;

    /** Brief description of what context is doing */
    note: string;

    /** The active objects in the current stack */
    readonly objects: MXCFrame[];

    /** The object instances on the stack */
    readonly objectStack: MXCFrame[];

    /** Callback that fires when the context is destroyed */
    onDestroy: function(MXC): void;

    /**
     * Returns objects from earlier in the stack.
     */
    readonly previousObjects: MUDObject[];

    /**
     * Decrement the reference count and optionally restore the previous context.
     */
    release(): MXC;

    /**
     * Restores thisPlayer, truePlayer, and objectStack from when the context
     * was originally created along with values collected during joins.
     */
    restore(): MXC;

    /**
     * Extends the alarm time by set amount
     * @param ms The number of milliseconds to extend alarm by.
     */
    snooze(ms: number);

    /** The first object in the LIFO stack */
    readonly thisObject: MUDObject;

    /** The player performing the current context */
    readonly thisPlayer: MUDObject;

    /** The player that triggered the events related to this context */
    readonly truePlayer: MUDObject;
}