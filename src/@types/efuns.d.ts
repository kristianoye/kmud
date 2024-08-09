/// <reference path="execution.d.ts" />
/// <reference path="mudobject.d.ts" />

declare module 'efuns' {
    global {
        interface IFileFunctions {
            /**
             * 
             * @param ecc The callstack
             * @param dirName The directory to create
             * @param options Options used when performing the creation
             */
            createDirectoryAsync(ecc: IExecutionContext, dirName: string, options: { createAsNeeded: boolean, errorIfExists: boolean }): Promise<boolean>;

            getObjectAsync(ecc: IExecutionContext, pathLike: string): Promise<IFileSystemObject>;
            getObjectAsync(ecc: IExecutionContext, query: IFileSystemQuery): Promise<IFileSystemObject>;
            getObjectAsync(pathLike: string): Promise<IFileSystemObject>;
            getObjectAsync(query: IFileSystemQuery): Promise<IFileSystemObject>;
        }

        interface IObjectFunctions {
            /** Load/create a MUD object */
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

            parsePath(ecc: IExecutionContext, pathLike: string): Readonly<IMUDTypeSpec>;
        }
    }
}