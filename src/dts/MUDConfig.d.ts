declare class DriverSection {
    /** Indicates whether the MUD is sharded or not */
    core: string;

    /** Max time allotted to evaluating any one command from a player (in ms) */
    maxCommandExecutionTime: number;

    /** The maximum number of characters allowed by the command processor */
    maxCommandLength: number;

    /** The max number of commands a character can execute per second */
    maxCommandsPerSecond: number;

    /** The maximum number of commands in a user input queue before new commands are ignored */
    maxCommandStackSize: number;

    /** Max time allotted to evaluating a block of code in eval() */
    maxEvalTime: number;

    /** Dictates how object instaces are constructed; Possible values are inline, thinWrapper, or fullWrapper */
    objectCreationMethod: string;

    /** Controls how often the driver checks for objects to reset (unless useLazyResets is true); Measured in ms */
    resetPollingInterval: number;

    /** Indicate whether to display driver frames in exception stacks (defaults to false) */
    showDriverFrames: boolean;

    /** If true then reset() is checked prior to executing a player action instead of by timer */
    useLazyResets: boolean;

    /** Indicates whether the driver should use proxies instead of wrappers to maintain object stack (defaults to false) */
    useObjectProxies: boolean;

    /** If true then proxies are revoked when an object is destructed */
    useRevocableProxies: boolean;
}

declare class MudlibSection {
    /** Contains a mapping of master object apply names */
    applyNames: Map<string, string>;

    /** The external file path to the root of the MUD filesystem */
    baseDirectory: string;

    /** The default error message sent to users if the verb is unrecognized */
    defaultError: string;

    /** The amount of time between heartbeats measured in ms; This is relative to the last completed heartbeat cycle. */
    heartbeatInterval: number;

    /** Contains a list of virtual paths to search for include files */
    includePath: string[];

    /** The default directory to which logs are written */
    logDirectory: string;

    /** The default amount of time between calls to reset (in ms) */
    objectResetInterval: number;

    /** Contains the virtual path to the in-game simul efun object (if any) */
    simulEfuns: string | false;
}

declare class MUDPasswordPolicy {
    /** Indicates whether authenticating against a plain text version of a password is allowed */
    readonly allowPlainTextAuth: boolean;

    /** The maximum number of characters allowed in a password. */
    readonly maxLength: number; 

    /** The minimum number of characters allowed in a password. */
    readonly minLength: number;

    /** The minimum number of upper-case characters required */
    readonly requiredUpper: number;

    /** The minimum number of lower-case characters required */
    readonly requiredLower: number;

    /** The minimum number of symbol characters required */
    readonly requiredSymbols: number;

    /** The minimum number of digits required */
    readonly requiredNumbers: number;

    /**
     * Validate a password policy
     * @param str The plain text entered by a user
     * @param enc The stored, encrypted text to check against
     * @param callback An optional callback for an async verification
     */
    checkPassword(str: string, enc: string, callback: (error: Error, success: boolean) => void): boolean;

    /**
     * Generate a password hash if security requirements are met or return error.
     * @param str The plain text password to hash.
     * @param callback An optional callback for async mode.
     */
    hashPasword(str: string, callback: (enc: string, error: Error) => void): string;

    /**
     * Checks to see if a password meets security requirements.
     * @param str The plain text password to check.
     */
    validPassword(str: string): true | string[];
}

declare class MUDSection {
    /** Contains the MUD name */
    name: string;

    /** Contains the in-game character name of the primary MUD admin; If prefixed with # then the name should be private */
    adminCharacter: string;

    /** Contains the email address of the primary MUD admin; If prefixed with # then the email should be considered private */
    adminEmail: string;

    /** Contains the name of the primary MUD admin; If prefixed with # then the name should be considered private */
    adminName: string;

    /** Contains a mapping of MUDLib-specific flags that are enabled */
    features: Map<string, boolean>;

    /** Authority for creating and validating passwords */
    passwordPolicy: MUDPasswordPolicy;
}

declare class MUDConfig {
    driver: DriverSection;

    mudlib: MudlibSection;

    mud: MUDSection;
}