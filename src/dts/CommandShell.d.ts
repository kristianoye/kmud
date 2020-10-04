
interface CommandShellOptions {
    /** Indicates the user can use command/verb aliasing */
    readonly allowAliases: boolean;

    /** Indicates the user can chain multiple commnads together. */
    readonly allowChaining: boolean;

    /** Indicates the user has environmental variables. */
    readonly allowEnvironment: boolean;

    /** Indicates the user can escape input of the input stack. */
    readonly allowEscaping: boolean;

    /** Indicates wildcards are expanded to file matches. */
    readonly allowFileExpressions: boolean;

    /** Indicates the user can perform I/O redirects. */
    readonly allowFileIO: boolean;

    /** Indicates the shell should track command history */
    readonly allowHistory: boolean;

    /** The user can use an escape character to span multiple lines of input. */
    readonly allowLineSpanning: boolean;

    /** Indicates the advanced object shell functionality is enabled. */
    readonly allowObjectShell: boolean;

    /** The maximum number of history entries to retain. 0 is infinite. */
    readonly maxHistorySize: boolean;
}

/** Represents a parsed command tree expression dispatched from the shell */
interface ParsedCommand {
    /** The next command to execute if the current command succeeded */
    conditional: ParsedCommand;

    /** The command to execute if the current command failed  */
    alternate: ParsedCommand;

    /** The next command to feed into once this command finished regardless of success */
    pipeline: ParsedCommand;

    /** The verb invoked by the user */
    verb: string;

    /** Parsed arguments to pass to the verb/command */
    args: any[];

    /** The original input from the user */
    original: string;

    /** The original input from the user minus the verb */
    text: string;
}