declare class DriverSection { }

declare class MudlibSection {
    /** The external file path to the root of the MUD filesystem */
    baseDirectory: string;

    /** The default directory to which logs are written */
    logDirectory: string;
}

declare class MUDSection { }

declare class MUDConfig {
    driver: DriverSection;

    mudlib: MudlibSection;

    mud: MUDSection;
}