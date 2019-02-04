declare class MUDClient {
    /**
     * Binds a body to the client.
     * @param body The body object (wrapper)
     */
    setBody(body: MUDEntity): MUDClient;
}

declare class MUDEntity extends MUDObject {
    /**
     * Called when the client binds
     * @param port
     * @param textType
     */
    connect(port: number, textType: string): any;
}

declare class MasterObject extends MUDObject {
    /**
     * Called when a new client connection is created.
     * @param port The port the client has attached to.
     * @param textType Indicates what type of text the client supports
     */
    connect(port: number, textType: string): MUDObject;

    /**
     * Determine if the specified read operation should be allowed
     * @param reader
     * @param target
     * @param method
     */
    validRead(reader: string, target: string, method: string): boolean;

    /**
     * Determine if the specified read operation should be allowed
     * @param reader
     * @param target
     * @param method
     */
    validWrite(reader: MUDObject, target: string, method: string): boolean;
}