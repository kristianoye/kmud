
declare class MUDCompilerOptions {
    /** Alternate parent module */
    altParent: MUDModule;

    /** Optional parameters to initialize the object */
    args: any[];

    /** File to write compiled source to */
    compilerOutput: string;

    /** The filename of the module to compile */
    file: string;

    /** Is the module a mixin object */
    isMixin: boolean;

    /** Do not create any object instances after compiling */
    noCreate: boolean;

    /** Do not seal the types found in the module */
    noSeal: boolean;

    /** Is this a reload vs an initial reload? */
    reload: boolean;

    /** The source code loaded from the file */
    source: string;
}

declare class PipelineContext {
    /** The transpiled and normalized source code */
    content: string;

    /** The module filename that is being compiled */
    filename: string;

    /** The fully-qualified filename of the module source */
    resolvedName: string;
}