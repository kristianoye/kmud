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
     * Manually creates a frame on the object stick.
     * @param frame
     */
    addFrame(frame: MXCFrame): MXC;

    /**
     * Clones the context and adds to the stack.
     */
    clone(): MXC;

    /** The verb that is executing in this context */
    readonly currentVerb: string;

    /**
     * Adds any additional frames to the context's object stack.
     */
    join(): MXC;

    /** The number of items in the object stack */
    readonly length: number;

    /** The object instances on the stack */
    readonly objectStack: MXCFrame[];

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

    /** The player performing the current context */
    readonly thisPlayer: MUDObject;

    /** The player that triggered the events related to this context */
    readonly truePlayer: MUDObject;
}