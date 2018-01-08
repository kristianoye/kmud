
declare class MUDCompiler {
    /**
     * Compiles an in-game module syncronously.
     * @param filename The name of the module being compiled.
     */
    compileObject(filename: string): MUDModule;

    /**
     * Compiles an in-game module syncronously.
     * @param filename The name of the module being compiled.
     * @param reload Set to true if the module should be recompiled and existing data preserved.
     */
    compileObject(filename: string, reload: boolean): MUDModule;

    /**
     * Compiles an in-game module syncronously.
     * @param filename The name of the module being compiled.
     * @param reload Set to true if the module should be recompiled and existing data preserved.
     * @param relativePath The path of the object requesting the module load.
     */
    compileObject(filename: string, reload: boolean, relativePath: string): MUDModule;

    /**
     * Compiles an in-game module syncronously.
     * @param filename The name of the module being compiled.
     * @param reload Set to true if the module should be recompiled and existing data preserved.
     * @param relativePath The path of the object requesting the module load.
     * @param constructorArgs Constructor arguments to pass to the initial instance.
     */
    compileObject(filename: string, reload: boolean, relativePath: string, constructorArgs: object): MUDModule;
}