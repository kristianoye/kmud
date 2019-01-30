declare class MUDCompilerOptions {
    /** Constructor arguments */
    args: any;

    /** The module to compile */
    file: string;

    /** Disables certain checks, adds another */
    isMixin: boolean;

    /** Do not create the "master" copy/instance when compiling */
    noCreate: boolean;

    /** The resulting class will not have a parent (reserved for special objects like SimulEfuns) */
    noParent: boolean;

    /** Do not seal the type once compiled  (defaults to false) */
    noSeal: boolean;

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