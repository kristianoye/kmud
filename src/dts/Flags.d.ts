
declare namespace system.flags {
    namespace fs {
        /** Flags for directory operations */
        class DirFlags {
            /** Do not cross filesystems */
            static readonly DontCrossFilesystems: number;

            /** Create directory structure as needed */
            static readonly EnsurePathExists: number;

            /** Recursive operation */
            static readonly RecursiveOperation: number;
        }
    }

    namespace shell {
        class ShellFlags {
            /** Allow commands to be chained together */
            static readonly AllowPipelining: number;

            /** Allow the use of environmental variables */
            static readonly AllowEnvironment: number;

            /** Allow the escaping of special characters (if false then \ is a literal character */
            static readonly AllowEscaping: number;

            /** If true then wildcard expressions are expanded automatically */
            static readonly AllowFileExpressions: number;

            /** If true, then the user may use I/O redirects */
            static readonly AllowFileIO: number;

            /** Allow the user to span a command across multiple lines using escapes */
            static readonly AllowLineSpanning: number;

            /** Allow the user to use PowerShell-like features */
            static readonly AllowObjectShell: number;

            static Parse(flags: number): CommandShellOptions;
        }
    }
}
