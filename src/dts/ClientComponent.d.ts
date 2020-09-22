/** A command issued by a connected player */
declare interface ClientCommand {
    /** The action verb to execute */
    readonly verb: string;

    /** Parsed arguments associated with the verb */
    readonly args: (string | { value: any })[];

    /** The raw line of text after the verb including whitespace */
    readonly text: string;
}

declare interface ClientComponent {
    /**
     * 
     * @param opts
     * @param callback
     */
    addPrompt(opts: any, callback: (str: string) => void): this;

    /** */
    eventSend(): void;
}