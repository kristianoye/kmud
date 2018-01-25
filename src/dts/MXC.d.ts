declare class MXCFrame {
    /** The name of the file the calling object is defined in */
    readonly file: string;

    /** The name of the function making the call */
    readonly func: string;

    /** The object instance making the call */
    readonly object: MUDObject;

    /** The frame 'signature' used to prevent duplicates */
    readonly sig: string;
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
    clone(init: (newCtx: MXC) => MXC);

    /**
     * Clones the current context and allows for an initializer.
     * @param init An optional initializer to customize the context.
     * @param note A note describing what the context is for.
     */
    clone(init: (newCtx: MXC) => MXC, note: string);

    /**
     * Adds any additional frames to the context's object stack.
     */
    join(): MXC;

    /** The number of items in the object stack */
    readonly length: number;

    /** Brief description of what context is doing */
    note: string;

    /** The object instances on the stack */
    readonly objectStack: MXCFrame[];

    /** Callback that fires when the context is destroyed */
    onDestroy: function(MXC):void;

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
     * Run a block of code in "this" context.
     * @param callback The code to execute as the current context.
     */
    run(callback: (args: ...any[]) => any): any;

    /**
     * Extends the alarm time by set amount
     * @param ms The number of milliseconds to extend alarm by.
     */
    snooze(ms: number);

    /** The player performing the current context */
    readonly thisPlayer: MUDObject;

    /** The player that triggered the events related to this context */
    readonly truePlayer: MUDObject;
}