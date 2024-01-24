
declare type MUDWrapper = () => MUDObject;

declare class MUDInfo {
    readonly arch: string;
    readonly architecture: string;
    readonly cpuUsage: string;
    readonly gameDriver: string;
    readonly hardware: string;
    readonly mudAdminName: string;
    readonly mudAdminEmail: string;
    readonly mudlibName: string;
    readonly mudlibBaseVersion: string;
    readonly mudMemoryTotal: string;
    readonly mudMemoryUsed: string;
    readonly name: string;
    readonly osbuild: string;
    readonly serverAddress: string;
    readonly systemMemoryUsed: string;
    readonly systemMemoryPercentUsed: string;
    readonly systemMemoryTotal: string;
    readonly uptime: number;
}

declare interface MUDStorage {

}


declare class MUDArgs {
    readonly length: number;

    nextIs(typeName: string): boolean;

    optional<T>(typeName: string): T;
    optional<T>(typeName: string, defaultValue: T): T;

    required<T>(typeName: string): T;
    required<T>(typeName: string, defaultValue: T): T;
}

declare function unwrap(target: MUDObject | MUDWrapper): MUDObject;

declare function unwrap(target: MUDObject | MUDWrapper, success: (ob: MUDObject) => MUDObject): MUDObject;

declare class MUDClientCaps {
    readonly clientHeight: number;
    readonly clientWidth: number;
    readonly colorEnabled: boolean;
    readonly htmlEnabled: boolean;
    readonly soundEnabled: boolean;
    readonly terminalType: string;
    readonly videoEnabled: boolean;
}

declare class MUDHelp {
    /** Describes the type of help object this is for (e.g. command, efun, etc) */
    type: string;

    /** Describes location of this help in the help hierarchy */
    category: string | string[];

    /** Contains the body of the help text */
    description: string;

    /** Contains related content */
    seeAlso: string | string[];
}

declare class MUDCommandOption {
    /** Contains one or more optional command switch */
    switches: string | string[];

    /** Describes the command switch and what it does */
    description: string;
}

declare class MUDCommandHelp extends MUDHelp {
    /** The name of the command this entry is for */
    command: string;

    /** Describes the possible options associated with the command */
    options: MUDCommandOption[];

    /** General usage help text */
    usage: string;
}

declare class MUDPrompt {
    /** Indicates whether the receiver recaptures user input focus */
    recapture: boolean;

    /** The text that will prompt the user for their next action */
    text: string;

    /** Indicates the type of input to be captured (text, password, etc) */
    type: string;
}

declare class MUDInputEvent {
    readonly args: string[];
    readonly caps: MUDClientCaps;
    readonly complete: () => any;
    readonly error: string;
    readonly fromHistory: boolean;
    readonly original: string;
    prompt: MUDPrompt;
    readonly text: string;
    readonly verb: string;
}

declare namespace HelpSystem {
    class HelpCategory {
        category: string;

        normalized: string;

        categories: Map<string, HelpCategory>;

        parent: HelpCategory;

        path: string;

        topics: Map<string, HelpCategory>;

        type: string;

        validAccess(user: MUDObject): boolean;
    }
}
