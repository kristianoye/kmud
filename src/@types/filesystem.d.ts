/// <reference path="execution.d.ts" />
/// <reference path="mudobject.d.ts" />

declare module 'filesystem' {
    import * as fs from 'fs';
    import { URL } from 'node:url';

    global {

        export type DateRangeLike = IDataRange | [number | Date, number | Date];
        export type BackupControlType = 'simple' | 'none' | 'off' | 'numbered' | 't' | 'existing' | 'nil';
        export type PathLike = string | Buffer | URL;

        interface IDataRange {
            start?: number;
            end?: number;
        }

        interface IBackupFileParms extends ICommonFileParms {
            control?: Readonly<BackupControlType>;
            suffix?: string;
        }

        /** Properties shared by most file I/O operations */
        interface ICommonFileParms {
            encoding?: string;
            file?: IFileSystemObject;
            filename?: string;
            files?: string | string[] | IFileSystemObject[];
            flags?: number;
            isSystemRequest?: boolean;
            recursive?: boolean;
            verb?: string;
            workingDirectory?: string;
        }

        interface ICreateDirectoryParms extends ICommonFileParms {
            createAsNeeded?: boolean;
            errorIfExists?: boolean;
        }

        interface ICopyFileParms extends ICommonFileParms {
            backupControl?: BackupControlType;
            backupSuffix?: string;
            destination?: string;
            errorIfExists?: boolean;
            failSilently?: boolean;
            onCopyComplete?: (ecc: IExecutionContext, verb: string, source: IFileSystemObject, dest: IFileSystemObject) => void;
            onCopyInformation?: (ecc: IExecutionContext, verb: string, message: string) => void;
            onCopyError?: (ecc: IExecutionContext, verb: string, err: Error) => void;
            onOverwritePrompt?: (ecc: IExecutionContext, verb: string, pathLike: string) => Promise<boolean>;
        }

        interface IDeleteFileParms extends ICommonFileParms {
            onConfirmDelete?: (ecc: IExecutionContext, verb: string, file: IFileSystemObject) => Promise<boolean>;
            onDeleteComplete?: (ecc: IExecutionContext, verb: string, pathLike: PathLike, object: IFileSystemObject) => void;
            onDeleteFailure?: (ecc: IExecutionContext, verb: string, displayPath: string, message: string) => void;
            onDeleteInformation?: (ecc: IExecutionContext, verb: string, message: string) => void;
        }

        /**
         * Parameters for loading and cloning game objects
         */
        interface ILoadObjectParms extends ICommonFileParms {
            /** Arguments to pass to the constructor */
            args?: any[];

            /** Optimize loading for known virtual type */
            isVirtual?: boolean;

            /** Load a specific object ID */
            objectId?: string;

            /** Load specified type from module */
            typeName?: string;
        }

        interface IMoveFileParms extends ICommonFileParms {
            backupControl?: BackupControlType;
            backupSuffix?: string;
            destination?: string;
            errorIfExists?: boolean;
            failSilently?: boolean;
            onMoveComplete?: (ecc: IExecutionContext, verb: string, source: IFileSystemObject, dest: IFileSystemObject) => void;
            onMoveInformation?: (ecc: IExecutionContext, verb: string, message: string) => void;
            onMoveError?: (ecc: IExecutionContext, verb: string, err: Error) => void;
            onOverwritePrompt?: (ecc: IExecutionContext, verb: string, pathLike: string) => Promise<boolean>;
        }

        interface IReadFileParms extends IFileSystemQuery {
            lineCount?: number;
            lineOffset?: number;
        }

        interface IWriteFileParms extends ICommonFileParms {
            /** Are we merely appending to file? */
            append?: boolean;

            /** The content to write to file */
            message?: string | Buffer;
        }

        interface IFileSystemObject extends fs.Stats {
            //#region Methods

            /** Does the file have a loadable extension known to the MUD compiler? */
            isLoadable(): boolean;
            /** Is the loadable module already loaded into memory? */
            isLoaded(): boolean;
            /** Is the file object read-only? */
            isReadOnly(): boolean;
            /** Is the file a system file?  e.g. permissions, etc */
            isSystemFile(): boolean;
            /** Is the file virtual with no direct physical file? */
            isVirtual(): boolean;
            /** Is the object wrapped for in-game use? */
            isWrapper(): boolean;

            //#endregion

            //#region Methods

            appendFileAsync(ecc: IExecutionContext, content: string | Buffer): Promise<boolean>;
            cloneObjectAsync(ecc: IExecutionContext, args: any[]): Promise<IMUDObject>;
            compileAsync(ecc: IExecutionContext): Promise<boolean>;
            copyAsync(): boolean;
            createDirectoryAsync(ecc: IExecutionContext): Promise<boolean>;
            createReadStream(ecc: IExecutionContext): ReadableStream;
            createWriteStream(ecc: IExecutionContext): WritableStream;
            deleteAsync(ecc: IExecutionContext): Promise<boolean>;
            deleteDirectoryAsync(ecc: IExecutionContext): Promise<boolean>;
            deleteFileAsync(ecc: IExecutionContext): Promise<boolean>;
            getParentAsync(ecc: IExecutionContext): Promise<IFileSystemObject>;
            getRelativePath(ecc: IExecutionContext, pathLike: string): string;
            isEmpty(ecc: IExecutionContext): Promise<boolean>;
            loadObjectAsync(ecc: IExecutionContext): Promise<IMUDObject>;
            moveAsync(ecc: IExecutionContext, options?: IMoveFileParms): Promise<boolean>;
            on(event: 'append', listener: (pathLike: string, file: IFileSystemObject) => void): this;
            on(event: 'clone', listener: (pathLike: string, newInstance: IMUDObject) => void): this;
            on(event: 'compile', listener: (pathLike: string, success: boolean) => void): this;
            on(event: 'copy', listener: (pathLike: string) => void): this;
            on(event: 'delete', listener: (pathLike: string) => void): this;
            on(event: 'move', listener: (pathLike: string) => void): this;
            on(event: 'write', listener: (pathLike: string, content: string | Buffer) => void): this;
            once(event: 'append', listener: (pathLike: string, file: IFileSystemObject) => void): this;
            once(event: 'clone', listener: (pathLike: string, newInstance: IMUDObject) => void): this;
            once(event: 'compile', listener: (pathLike: string, success: boolean) => void): this;
            once(event: 'copy', listener: (pathLike: string) => void): this;
            once(event: 'delete', listener: (pathLike: string) => void): this;
            once(event: 'move', listener: (pathLike: string) => void): this;
            once(event: 'write', listener: (pathLike: string, content: string | Buffer) => void): this;
            readDirectoryAsync(ecc: IExecutionContext, query: IFileSystemQuery): Promise<IFileSystemObject[]>;
            readFile(ecc: IExecutionContext, query: IFileSystemQuery & { resultType: 'string' }): Promise<string>;
            readFile(ecc: IExecutionContext, query: IFileSystemQuery & { resultType: 'buffer' }): Promise<Buffer>;
            readJsonAsync<T>(ecc: IExecutionContext): Promise<T>;
            readYamlAsync<T>(ecc: IExecutionContext): Promise<T>;
            refreshAsync(ecc: IExecutionContext): Promise<IFileSystemObject>;
            writeAsync(ecc: IExecutionContext, content: string | Buffer): Promise<boolean>;
            writeJsonAsync(ecc: IExecutionContext, content: any): Promise<boolean>;
            writeYamlAsync(ecc: IExecutionContext, context: object): Promise<boolean>;

            //#endregion
        }

        interface IFileSystemQuery {
            //#region Properties

            contains?: string | RegExp;
            dateCreated?: DateRangeLike;
            dateModified?: DateRangeLike;
            directories?: boolean;
            file?: string | IFileSystemObject;
            files?: boolean;
            isSystemRequest?: boolean;
            maxMatches?: number;
            maxSize?: number;
            minSize?: number;
            mustExist?: boolean;
            pattern?: string;
            resultType?: 'string' | 'buffer';

            //#endregion

            //#region Events

            /**
             * An event that fires when a file matches the 'contains' pattern.
             * @param ecc The callstack
             * @param entry The file with matching content
             * @param matchData Match data resulting from a regex evaluation
             * @param matchCount The number of times the pattern matched
             * @param pattern The original pattern passed in the query
             */
            onContentMatch?: (ecc: IExecutionContext, entry: IFileSystemObject, matchData: RegExpMatchArray, matchCount?: number, pattern?: string | RegExp) => void;

            /**
             * An event that fires for every file that matches the filename pattern
             * @param ecc The callstack
             * @param entry The entry that matched the pattern
             * @returns 
             */
            onPatternMatch?: (ecc: IExecutionContext, entry: IFileSystemObject) => void;

            //#endregion
        }

        interface IFileSystem {
            /**
             * 
             * @param ecc The callstack
             * @param pathLike The object to fetch
             */
            getObjectAsync(ecc: IExecutionContext, pathLike: string,): Promise<IFileSystemObject>;
        }

        /**
         * The file manager singleton is created by the driver during startup.
         */
        interface IFileManager {

            //#region Properties

            /**
             * The mounted filesystems (mapped by mount point)
             */
            fileSystems: Map<string, IFileSystem>;

            //#endregion

            //#region Methods

            /**
             * Wrap up native file objects into MUD-safe objects with security assertions
             * @param ecc The callstack
             * @param objects Objects to wrap going into the MUD sandbox
             */
            createFileWrappers(ecc: IExecutionContext, objects: IFileSystemObject[]): IFileSystemObject[];

            /**
             * Fetch a file object from this particular filesystem.
             * @param ecc The callstack
             * @param pathLike The object to fetch
             * @param options Additional criteria to restrict the result
             */
            getObjectAsync(ecc: IExecutionContext, pathLike: string, options?: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Fetch a file object from this particular filesystem.
             * @param ecc The callstack
             * @param options Additional criteria to restrict the result
             */
            getObjectAsync(ecc: IExecutionContext, options?: IFileSystemQuery): Promise<IFileSystemObject>;

            /**
             * Query the file system for a list of objects matching the criteria
             * @param ecc The callstack
             * @param query The query to execute
             */
            queryFilesystemAsync(ecc: IExecutionContext, query: IFileSystemQuery): Promise<IFileSystemObject[]>;

            //#endregion
        }
    }
}