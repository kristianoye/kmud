
declare class MUDStorage {
    /** Flags related to the object instance associated with this store */
    flags: number;

    /** Listen for a particular event from the mudlib/driver */
    on(event: string, callback: (...args: any[]) => any): void;

    /** get a property from the storage layer */
    getProperty(prop: string, defaultValue: any): any

    /** set a property in the storage layer */
    setProperty(prop: string, value: any): MUDObject;

    /** set a symbol in the storage layer */
    setSymbol(prop: Symbol, value: any): MUDObject;

    /** Indicates the object is interactive */
    public static PROP_INTERACTIVE = 1 << 0;

    /** Indicates the object is connected (not linkdead) */
    public static PROP_CONNECTED = 1 << 1;

    /** Indicates the object is living and can execute commands */
    public static PROP_LIVING = 1 << 2;

    /** Indicates the object has wizard permissions */
    public static PROP_WIZARD = 1 << 3;

    /** Indicates the interactive object is idle */
    public static PROP_IDLE = 1 << 4;

    /** Indicates the object is in edit mode */
    public static PROP_EDITING = 1 << 5;

    /** Indicates the object is in input mode */
    public static PROP_INPUT = 1 << 6;
}
