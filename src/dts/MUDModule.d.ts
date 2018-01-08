
declare class MUDModule {
    children: MUDModule[];

    /**
     * A reference to the compiled class
     */
    classRef: object;

    /**
     * Create an instance of the module.
     * @param instanceId The numeric instance of the object (index in instances array)
     * @param isReload If true then the object data storage should be preserved and associated with the new instance.
     */
    createInstance(instanceId: number, isReload: boolean): MUDObject;

    /**
     * Create an instance of the module.
     * @param instanceId The numeric instance of the object (index in instances array)
     * @param isReload If true then the object data storage should be preserved and associated with the new instance.
     * @param args Arguments to pass to the object constructor.
     */
    createInstance(instanceId: number, isReload: boolean, args: any): MUDObject;

    /**
     * Destructs an instance of the module
     * @param instanceId The numeric index of the object (see instances).
     */
    destroyInstance(instanceId: number): void;

    /**
     * The name of the file from which the module was loaded.
     */
    filename: string;

    instances: object[];

    isVirtual: boolean;

    /** Indicates whether this object compiled successfully or not. */
    loaded: boolean;

    /** Indicates whether this object is allowed to exist multiple times */
    singleton: boolean;
}