declare module 'mudobject' {
    global {
        /**
         * @property {MUDObject} instance The instance this wrapper points to
         * @property {string} objectId The unique object id (uuid) assigned to this object
         */
        export type IMUDWrapper = () => IMUDObject & IMUDObject;

        /**
         * The basis for all in-game objects
         */
        interface IMUDObject {
            /** The time at which the object was created */
            readonly createTime: number;

            /** The filename to the module appended with the type; Could be virtual */
            readonly filename: string;

            /** The full path to the actual module */
            readonly fullPath: string;

            /** The security identifier assigned by the in-game MasterObject */
            readonly identity: string;

            /** A reference back to the object itself */
            readonly instance: IMUDObject;

            /** Objects contained within this object */
            readonly inventory: IMUDObject[];

            /** Is the object virtual, meaning it has a path that is not a real file? */
            readonly isVirtual: boolean;

            /** Is this object a wrapper?  Nope*/
            readonly isWrapper: false;

            /** Get a reference to the wrapper object */
            readonly wrapper: IMUDWrapper;

            /** The unique ID assigned to this object */
            readonly objectId: string;

            /** The containing object */
            readonly environment?: IMUDObject;

            /** Has the object been destructed? */
            readonly destructed: boolean;

            /**
             * The MUD's replacement for constructor
             * @param ecc The callstack
             */
            create(ecc: IExecutionContext): void;

            /**
             * Called when a new object enters into the object
             * @param ecc The callstack
             */
            initAsync(ecc: IExecutionContext): Promise<void>;

            /**
             * Moves the object into a new environment
             * @param ecc The callstack
             */
            moveObjectAsync(ecc: IExecutionContext): Promise<boolean>;

            /**
             * Similar to write() but allows for a specific message class.
             * @param ecc The callstack
             * @param msgClass The message class
             * @param msg The message itself
             */
            receiveMessage(ecc: IExecutionContext, msgClass: string, msg: string): void;

            /**
             * Serialize the object into JSON
             * @param ecc The callstack
             */
            serializeObject(ecc: IExecutionContext): string;

            /**
             * Write a message to the object's output
             * @param ecc The callstack
             * @param msg The message to send to the client
             */
            write(ecc: IExecutionContext, msg: string): IMUDObject;

            /**
             * Write a message to the object's output
             * @param ecc The callstack
             * @param msg The message to send to the client
             */
            writeLine(ecc: IExecutionContext, msg: string): IMUDObject;
        }
    }
}