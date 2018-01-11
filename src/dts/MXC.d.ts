
declare class MXC {
    /**
     * Adds any additional frames to the context's object stack.
     */
    join(): MXC;

    /**
     * Restores thisPlayer, truePlayer, and objectStack from when the context
     * was originally created along with values collected during joins.
     */
    restore(): MXC;
}