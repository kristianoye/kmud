if (typeof system !== 'object')
    system = {};

/**
 * Create one or more namespaces
 * @param {...string} items
 */
function createNamespaces(...items) {
    items.forEach(ns => {
        let parts = ns.split('.'),
            node = system;

        parts.forEach((ss, i) => {
            if (i > 0) {
                if (typeof node[ss] !== 'object') node[ss] = {};
                node = node[ss];
            }
        });
    });
}

createNamespaces(
    'system.fs',
    'system.flags.fs',
    'system.flags.shell');

system.flags.fs.DirFlags = Object.freeze({
    /** Do not cross filesystems */
    DontCrossFilesystems: 1 << 1,

    /** Create directory structure as needed */
    EnsurePathExists: 1 << 0,

    /** Recursive operation */
    Recursive: 1 << 2
});

system.flags.shell.ShellFlags = Object.freeze({
    /** Allow commands to be chained together */
    AllowPipelining: 1 << 0,

    /** Allow the use of environmental variables */
    AllowEnvironment: 1 << 1,

    /** Allow the escaping of special characters (if false then \ is a literal character */
    AllowEscaping: 1 << 2,

    /** If true then wildcard expressions are expanded automatically */
    AllowFileExpressions: 1 << 3,

    /** If true, then the user may use I/O redirects */
    AllowFileIO: 1 << 4,

    /** Allow the user to span a command across multiple lines using escapes */
    AllowLineSpanning: 1 << 5,

    /** Allow the user to use PowerShell-like features */
    AllowObjectShell: 1 << 6,

    /**
     * Parse bitflags into a shell options object
     * @returns {CommandShellOptions} 
     */
    Parse: (flags) => {
        let ShellFlags = system.flags.shell.ShellFlags;
        return {
            allowEnvironment: (flags & ShellFlags.AllowEnvironment) > 0,
            allowEscaping: (flags & ShellFlags.AllowEscaping) > 0,
            allowFileExpressions: (flags & ShellFlags.AllowFileExpressions) > 0,
            allowFileIO: (flags & ShellFlags.AllowFileIO) > 0,
            allowLineSpanning: (flags & ShellFlags.AllowLineSpanning) > 0,
            allowObjectShell: (flags & ShellFlags.AllowObjectShell) > 0,
            allowPipelining: (flags & ShellFlags.AllowPipelining) > 0
        };
    }
});

Object.freeze(system);

