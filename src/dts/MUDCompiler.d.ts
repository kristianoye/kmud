declare class MUDCompilerOptions {
    /** Constructor arguments */
    args: any;

    /** The module to compile */
    file: string;

    /** The resulting class will not have a parent (reserved for special objects like SimulEfuns) */
    noParent: boolean;

    /** The relative path to the compiler request */
    relativePath: string;

    /** Indicates whether the request is a reload of an existing object */
    reload: boolean;
}

declare class MUDCompiler {
    /**
     * Compile module using options object.
     * @param options
     */
    compileObject(options: MUDCompilerOptions): MUDModule;

    /**
     * Compiles an in-game module syncronously.
     * @param filename The name of the module being compiled.
     */
    compileObject(filename: string): MUDModule;
}