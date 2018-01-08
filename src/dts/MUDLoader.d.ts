
declare class MUDLoader {
    /** The efun instance this loader is tied to */
    readonly efuns: EFUNProxy;

    /**
     * Includes a file into the current context/namespace.
     * @param expr The file to "include".
     */
    include(expr: string): void;
}