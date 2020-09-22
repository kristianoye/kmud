
declare namespace system.flags {
    declare namespace fs {
        /** Flags for directory operations */
        enum DirFlags {
            /** Do not cross filesystems */
            DontCrossFilesystems = 1 << 1,

            /** Create directory structure as needed */
            EnsurePathExists = 1 << 0,

            /** Recursive operation */
            RecursiveOperation = 1 << 2
        }
    }
}
