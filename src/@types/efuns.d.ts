/// <reference path="execution.d.ts" />
/// <reference path="mudobject.d.ts" />
/// <reference path="filesystem.d.ts" />

declare module 'efuns' {
    global {
        /** Options used when compiling MUD objects */
        interface IMUDCompilerParms extends ICommonFileParms {
            /** Numeric bitflag representation of options */
            flags?: number;

            /** Should dependent modules be re-compiled? */
            compileDependents?: boolean;

            /** Skip recreation existing instances? */
            noCreate?: boolean;

            /** Skip recreation existing of dependent instances? */
            noCreateDependents?: boolean;

            /** Check syntax, do not attempt to reload module */
            noEmit?: boolean;

            /** Code to compile */
            source?: string | Buffer;
        }

        /** File-related external functions */
        interface IFileFunctions {
            //#region appendFileAsync()

            /**
             * Append content to a file
             * @param ecc The callstack
             * @param fileLike The filename to write to
             * @param content The content to append to the file
             * @param options Options to use to control the operation
             */
            appendFileAsync(ecc: IExecutionContext, fileLike: string, content: string | Buffer, options?: IWriteFileParms): Promise<boolean>;

            /**
             * Append content to a file
             * @param ecc The callstack
             * @param options Options to use to control the operation
             */
            appendFileAsync(ecc: IExecutionContext, options: IWriteFileParms): Promise<boolean>;

            /**
             * Append content to a file
             * @param fileLike The filename to write to
             * @param content The content to append to the file
             */
            appendFileAsync(fileLike: string, content: string | Buffer): Promise<boolean>;

            /**
             * Append content to a file
             * @param options Options to use to control the operation
             */
            appendFileAsync(options: IWriteFileParms): Promise<boolean>;

            //#endregion

            //#region compileAsync()

            /**
             * Compile one or more MUD modules
             * @param ecc The callstack
             * @param options Parameters to pass to the compiler
             */
            compileAsync(ecc: IExecutionContext, options: IMUDCompilerParms): Promise<boolean>;

            /**
             * Compile one or more MUD modules
             * @param options Parameters to pass to the compiler
             */
            compileAsync(options: IMUDCompilerParms): Promise<boolean>;

            //#endregion

            //#region copyAsync()

            /**
             * Copy one or more files to the target destination
             * @param ecc The callstack
             * @param source The source file to copy
             * @param dest The destination to copy the file to
             * @param options Options to control the operation
             */
            copyAsync(ecc: IExecutionContext, source: string, dest: string, options?: ICopyFileParms): Promise<boolean>;

            /**
             * Copy one or more files to the target destination
             * @param ecc The callstack
             * @param options Options to control the operation
             */
            copyAsync(ecc: IExecutionContext, options: ICopyFileParms): Promise<boolean>;

            /**
             * Copy one or more files to the target destination
             * @param source The source file to copy
             * @param dest The destination to copy the file to
             * @param options Options to control the operation
             */
            copyAsync(source: string, dest: string, options?: ICopyFileParms): Promise<boolean>;

            /**
             * Copy one or more files to the target destination
             * @param options Options to control the operation
             */
            copyAsync(options: ICopyFileParms): Promise<boolean>;

            //#endregion

            //#region createBackupAsync()

            /**
             * Create a backup of one or more files
             * @param ecc The callstack
             * @param options Options to control the backup
             */
            createBackupAsync(ecc: IExecutionContext, options: IBackupFileParms): Promise<boolean>;

            /**
             * Create a backup of one or more files
             * @param options Options to control the backup
             */
            createBackupAsync(options: IBackupFileParms): Promise<boolean>;


            //#endregion

            //#region createDirectoryAsync()

            /**
             * 
             * @param ecc The callstack
             * @param dirName The directory to create
             * @param options Options used when performing the creation
             */
            createDirectoryAsync(ecc: IExecutionContext, dirName: string, options?: Partial<ICreateDirectoryParms>): Promise<boolean>;
            createDirectoryAsync(ecc: IExecutionContext, options: Partial<ICreateDirectoryParms>): Promise<boolean>;
            createDirectoryAsync(dirName: string, options?: { createAsNeeded: boolean, errorIfExists: boolean }): Promise<boolean>;
            createDirectoryAsync(options: { createAsNeeded: boolean, errorIfExists: boolean }): Promise<boolean>;

            //#endregion

            //#region getObject

            /**
             * Get an in-game MUD object
             * @param ecc The callstack
             * @param pathLike The module path to fetch
             * @param query Additional criteria used to locate the object
             */
            getObjectAsync(ecc: IExecutionContext, pathLike: PathLike, query?: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Get an in-game MUD object
             * @param ecc The callstack
             * @param query Additional criteria used to locate the object
             */
            getObjectAsync(ecc: IExecutionContext, query: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Get an in-game MUD object
             * @param pathLike The module path to fetch
             * @param query Additional criteria used to locate the object
             */
            getObjectAsync(pathLike: PathLike, query?: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Get an in-game MUD object
             * @param query Additional criteria used to locate the object
             */
            getObjectAsync(query: IFileSystemQuery): Promise<IFileSystemObject>;

            //#endregion

            //#region deleteAsync()

            /**
             * Delete one or more files
             * @param ecc The callstack
             * @param pathLike The file to delete
             * @param options Additional options for the delete operation
             */
            deleteAsync(ecc: IExecutionContext, pathLike: PathLike, options?: IDeleteFileParms): Promise<boolean>;

            /**
             * Delete one or more files
             * @param ecc The callstack
             * @param options Additional options for the delete operation
             */
            deleteAsync(ecc: IExecutionContext, options: IDeleteFileParms): Promise<boolean>;

            /**
             * Delete one or more files
             * @param pathLike The file to delete
             * @param options Additional options for the delete operation
             */
            deleteAsync(pathLike: PathLike, options?: IDeleteFileParms): Promise<boolean>;

            /**
             * Delete one or more files
             * @param options Additional options for the delete operation
             */
            deleteAsync(options: IDeleteFileParms): Promise<boolean>;

            //#endregion

            //#region getBackupExtension()

            /**
             * Get the backup extension for a file.
             * @param ecc The callstack
             * @param pathLike The path to create a backup for
             * @param options Options that dictate the naming convention
             */
            getBackupExtension(ecc: IExecutionContext, pathLike: PathLike, options?: IBackupFileParms): string;

            /**
             * Get the backup extension for a file.
             * @param ecc The callstack
             * @param options Options that dictate the naming convention
             */
            getBackupExtension(ecc: IExecutionContext, options?: IBackupFileParms): string;

            /**
             * Get the backup extension for a file.
             * @param pathLike The path to create a backup for
             * @param options Options that dictate the naming convention
             */
            getBackupExtension(pathLike: PathLike, options?: IBackupFileParms): string;

            /**
             * Get the backup extension for a file.
             * @param options Options that dictate the naming convention
             */
            getBackupExtension(options?: IBackupFileParms): string;

            //#endregion

            //#region getDirectoryAsync()

            /**
             * Specifically get a directory object; Asserts the result is an object
             * @param ecc The callstack
             * @param pathLike The directory to fetch
             * @param options Criteria used to find the correct directory
             */
            getDirectoryAsync(ecc: IExecutionContext, pathLike: PathLike, options?: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Specifically get a directory object; Asserts the result is an object
             * @param ecc The callstack
             * @param options Criteria used to find the correct directory
             */
            getDirectoryAsync(ecc: IExecutionContext, options: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Specifically get a directory object; Asserts the result is an object
             * @param pathLike The directory to fetch
             * @param options Criteria used to find the correct directory
             */
            getDirectoryAsync(pathLike: PathLike, options?: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Specifically get a directory object; Asserts the result is an object
             * @param options Criteria used to find the correct directory
             */
            getDirectoryAsync(options: IFileSystemQuery): Promise<IFileSystemObject>;

            //#endregion

            //#region getFileAsync()

            /**
             * Specifically get a file object; Asserts the result is an object is a file
             * @param ecc The callstack
             * @param pathLike The file to fetch
             * @param options Criteria used to find the correct file
             */
            getFileAsync(ecc: IExecutionContext, pathLike: PathLike, options?: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Specifically get a file object; Asserts the result is an object is a file
             * @param ecc The callstack
             * @param options Criteria used to find the correct file
             */
            getFileAsync(ecc: IExecutionContext, options: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Specifically get a file object; Asserts the result is an object is a file
             * @param pathLike The file to fetch
             * @param options Criteria used to find the correct file
             */
            getFileAsync(pathLike: PathLike, options?: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Specifically get a file object; Asserts the result is an object is a file
             * @param options Criteria used to find the correct file
             */
            getFileAsync(options: IFileSystemQuery): Promise<IFileSystemObject>;

            //#endregion

            //#region getObjectAsync()

            /**
             * Specifically get a file object
             * @param ecc The callstack
             * @param pathLike The file to fetch
             * @param options Criteria used to find the correct file
             */
            getObjectAsync(ecc: IExecutionContext, pathLike: PathLike, options?: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Specifically get a file object
             * @param ecc The callstack
             * @param options Criteria used to find the correct file
             */
            getObjectAsync(ecc: IExecutionContext, options: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Specifically get a file object
             * @param pathLike The file to fetch
             * @param options Criteria used to find the correct file
             */
            getObjectAsync(pathLike: PathLike, options?: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Specifically get a file object
             * @param options Criteria used to find the correct file
             */
            getObjectAsync(options: IFileSystemQuery): Promise<IFileSystemObject>;

            //#endregion

            //#region isDirectoryAsync()

            /**
             * Check if a path expression is a directory
             * @param ecc The callstack
             * @param pathLike The path expression to check
             */
            isDirectoryAsync(ecc: IExecutionContext, pathLike: PathLike): Promise<boolean>;

            /**
             * Check if a path expression is a directory
             * @param pathLike The path expression to check
             */
            isDirectoryAsync(pathLike: PathLike): Promise<boolean>;

            //#endregion

            //#region isFileAsync()

            /**
             * Check if a path expression is a file
             * @param ecc The callstack
             * @param pathLike The path expression to check
             */
            isFileAsync(ecc: IExecutionContext, pathLike: PathLike): Promise<boolean>;

            /**
             * Check if a path expression is a file
             * @param pathLike The path expression to check
             */
            isFileAsync(pathLike: PathLike): Promise<boolean>;

            //#endregion

            //#region queryFileSystemAsync()

            /**
             * Query the filesystem for matching objects the criteria
             * @param ecc The callstack
             * @param query The query to perform
             */
            queryFileSystemAsync(ecc: IExecutionContext, query: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Query the filesystem for matching objects the criteria
             * @param query The query to perform
             */
            queryFileSystemAsync(query: IFileSystemQuery): Promise<IFileSystemObject>;

            //#endregion

            //#region readDirectoryAsync()

            /**
             * Read directory contents
             * @param ecc The callstack
             * @param pathLike The path expression to read
             * @param options Optional criteria for filtering files
             */
            readDirectoryAsync(ecc: IExecutionContext, pathLike: PathLike, options?: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Read directory contents
             * @param ecc The callstack
             * @param options Optional criteria for filtering files
             */
            readDirectoryAsync(ecc: IExecutionContext, options: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Read directory contents
             * @param pathLike The path expression to read
             * @param options Optional criteria for filtering files
             */
            readDirectoryAsync(pathLike: PathLike, options?: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Read directory contents
             * @param options Optional criteria for filtering files
             */
            readDirectoryAsync(options: IFileSystemQuery): Promise<IFileSystemObject>;

            //#endregion

            //#region readFileAsync()

            /**
             * Read content from a file
             * @param ecc THe callstack
             * @param pathLike The path expression to read from
             * @param options Additional options to control the read operation
             */
            readFileAsync(ecc: IExecutionContext, pathLike: PathLike, options?: IReadFileParms): Promise<string | Buffer>;

            /**
             * Read content from a file
             * @param ecc THe callstack
             * @param options Additional options to control the read operation
             */
            readFileAsync(ecc: IExecutionContext, options: IReadFileParms): Promise<string | Buffer>;

            /**
             * Read content from a file
             * @param pathLike The path expression to read from
             * @param options Additional options to control the read operation
             */
            readFileAsync(pathLike: PathLike, options?: IReadFileParms): Promise<string | Buffer>;

            /**
             * Read content from a file
             * @param options Additional options to control the read operation
             */
            readFileAsync(options: IReadFileParms): Promise<string | Buffer>;

            //#endregion

            //#region readJsonAsync()

            /**
             * Read a JSON object from a file.
             * @param ecc The callstack
             * @param pathLike The file path to read from
             * @param options Options to control the operation
             */
            readJsonAsync(ecc: IExecutionContext, pathLike: PathLike, options?: IReadFileParms): Promise<object>;

            /**
             * Read a JSON object from a file.
             * @param ecc The callstack
             * @param options Options to control the operation
             */
            readJsonAsync(ecc: IExecutionContext, options: IReadFileParms): Promise<object>;

            /**
             * Read a JSON object from a file.
             * @param pathLike The file path to read from
             * @param options Options to control the operation
             */
            readJsonAsync(pathLike: PathLike, options?: IReadFileParms): Promise<object>;

            /**
             * Read a JSON object from a file.
             * @param options Options to control the operation
             */
            readJsonAsync(options: IReadFileParms): Promise<object>;

            //#endregion

            //#region readYamlAsync()

            /**
             * Read a Yaml object from a file.
             * @param ecc The callstack
             * @param pathLike The file path to read from
             * @param options Options to control the operation
             */
            readYamlAsync<T>(ecc: IExecutionContext, pathLike: PathLike, options?: IReadFileParms): Promise<T>;

            /**
             * Read a Yaml object from a file.
             * @param ecc The callstack
             * @param options Options to control the operation
             */
            readYamlAsync<T>(ecc: IExecutionContext, options: IReadFileParms): Promise<T>;

            /**
             * Read a Yaml object from a file.
             * @param pathLike The file path to read from
             * @param options Options to control the operation
             */
            readYamlAsync<T>(pathLike: PathLike, options?: IReadFileParms): Promise<T>;

            /**
             * Read a Yaml object from a file.
             * @param options Options to control the operation
             */
            readYamlAsync<T>(options: IReadFileParms): Promise<T>;

            //#endregion

            //#region writeFileAsync()

            /**
             * Write content to a file
             * @param ecc The callstack
             * @param pathLike The file path to write to
             * @param content The data to write to the file
             * @param options Additional parameters for the operation
             */
            writeFileAsync(ecc: IExecutionContext, pathLike: PathLike, content: string | Buffer, options?: IWriteFileParms): Promise<boolean>;

            /**
             * Write content to a file
             * @param ecc The callstack
             * @param options Additional parameters for the operation
             */
            writeFileAsync(ecc: IExecutionContext, options: IWriteFileParms): Promise<boolean>;

            /**
             * Write content to a file
             * @param pathLike The file path to write to
             * @param content The data to write to the file
             * @param options Additional parameters for the operation
             */
            writeFileAsync(pathLike: PathLike, content: string | Buffer, options?: IWriteFileParms): Promise<boolean>;

            /**
             * Write content to a file
             * @param content The data to write to the file
             * @param options Additional parameters for the operation
             */
            writeFileAsync(options: IWriteFileParms): Promise<boolean>;

            //#endregion

            //#region writeJsonAsync()

            /**
             * Write an object in JSON format to file
             * @param ecc The callstack
             * @param pathLike The file path to write to
             * @param content The object to write to storage
             * @param options Additional parameters for the operation
             */
            writeJsonAsync(ecc: IExecutionContext, pathLike: PathLike, content: object, options?: IWriteFileParms): Promise<boolean>;

            /**
             * Write an object in JSON format to file
             * @param ecc The callstack
             * @param pathLike The file path to write to
             * @param content The object to write to storage
             * @param options Additional parameters for the operation
             */
            writeJsonAsync(ecc: IExecutionContext, options: IWriteFileParms): Promise<boolean>;

            /**
             * Write an object in JSON format to file
             * @param ecc The callstack
             * @param pathLike The file path to write to
             * @param content The object to write to storage
             * @param options Additional parameters for the operation
             */
            writeJsonAsync(pathLike: PathLike, content: object, options?: IWriteFileParms): Promise<boolean>;

            /**
             * Write an object in JSON format to file
             * @param ecc The callstack
             * @param pathLike The file path to write to
             * @param content The object to write to storage
             * @param options Additional parameters for the operation
             */
            writeJsonAsync(options: IWriteFileParms): Promise<boolean>;

            //#endregion

            //#region writeYamlAsync()

            /**
             * Write an object in Yaml format to file
             * @param ecc The callstack
             * @param pathLike The file path to write to
             * @param content The object to write to storage
             * @param options Additional parameters for the operation
             */
            writeYamlAsync<T>(ecc: IExecutionContext, pathLike: PathLike, content: T, options?: IWriteFileParms): Promise<boolean>;

            /**
             * Write an object in Yaml format to file
             * @param ecc The callstack
             * @param pathLike The file path to write to
             * @param content The object to write to storage
             * @param options Additional parameters for the operation
             */
            writeYamlAsync<T>(pathLike: PathLike, content: T, options?: IWriteFileParms): Promise<boolean>;

            //#endregion
        }

        interface IObjectFunctions {
            //#region cloneObjectAsync()

            cloneObjectAsync(ecc: IExecutionContext, options: Partial<ILoadObjectParms>): Promise<IMUDObject>;
            cloneObjectAsync(ecc: IExecutionContext, pathLike: PathLike, options: Partial<ILoadObjectParms>): Promise<IMUDObject>;
            cloneObjectAsync(pathLike: PathLike, options: Partial<ILoadObjectParms>): Promise<IMUDObject>;
            cloneObjectAsync(options: Partial<ILoadObjectParms>): Promise<IMUDObject>;

            //#endregion

            loadObjectAsync(ecc: IExecutionContext, options: ILoadObjectParms): Promise<IMUDObject>;
            loadObjectAsync(options: ILoadObjectParms): Promise<IMUDObject>;
        }

        interface IMUDTypeSpec {
            file: string;
            type: string;
            extension?: string;
            objectId?: string;
            defaultType?: boolean;
        }

        interface IEFUNProxy {
            /**
             * Bind an action to the current object
             * @param ecc The callstack
             * @param verb The verb to bind
             * @param action The action to perform when the verb is invoked
             */
            addAction(ecc: IExecutionContext, verb: string, action: (verb: string) => any): void;

            /**
             * Add an object to the output stream
             * @param ecc The callstack
             * @param obj The object to add to the stream
             */
            addOutputObject(ecc: IExecutionContext, obj: IMUDObject): void;

            /**
             * Check to see if the specified object is an administrator
             * @param ecc The callstack
             * @param obj The object to evaluate
             */
            adminp(ecc: IExecutionContext, obj: IMUDObject): boolean;

            /**
             * Check to see if the specified object is an assistant administrator
             * @param ecc The callstack
             * @param obj The object to evaluate
             */
            archp(ecc: IExecutionContext, obj: object): boolean;

            /**
             * 
             * @param ecc The callstack
             * @param list A list of objects and/or strings to consolidate into a sentence fragment
             */
            arrayToSentence(ecc: IExecutionContext, list: (IMUDObject | string)[]): string;

            /**
             * Bind an object function by name
             * @param ecc The callstack
             * @param target The object to create a binding on
             * @param methodName The name of the method to bind
             * @param args Parameters to pass in the binding
             */
            bindFunctionByName(ecc: IExecutionContext, target: IMUDObject, methodName: string, ...args: any): (thisObj: IMUDObject, ...args: any) => any;

            /**
             * Returns true if the provided cipher text matches the encrypted cipherText
             * @param ecc The callstack
             * @param plain The plain text supplied by the user
             * @param cipherText The cipher/encrypted text to compare against
             */
            checkPassword(ecc: IExecutionContext, plain: string, cipherText: string): boolean;

            /**
             * External functions for performing file operations
             */
            readonly fs: Readonly<IFileFunctions>;

            /**
             * External functions for interacting with game objects
             */
            readonly objects: Readonly<IObjectFunctions>;

            parsePath(ecc: IExecutionContext, pathLike: PathLike): Readonly<IMUDTypeSpec>;
        }
    }
}