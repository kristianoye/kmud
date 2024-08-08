declare module 'mudobject' {
    global {
        interface MUDObject {
            /**
             * The unique ID assigned to this object
             */
            readonly objectId: string;
        }
    }
}