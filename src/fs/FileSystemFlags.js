
const
    FileSystemQueryFlags = Object.freeze({
        /** No options; Use defaults */
        None: 0,

        /** Show files that are marked as hidden */
        ShowHiddenFiles: 1 << 0,

        /** Allow system files in results */
        ShowSystemFiles: 1 << 1,

        /** Do not cross filesystems */
        SingleFileSystem: 1 << 2,

        /** Perform recursive search */
        Recursive: 1 << 3,

        /** Do not return normal files */
        IgnoreFiles: 1 << 4,

        /** Do not return directories */
        IgnoreDirectories: 1 << 5
    });

module.exports = { FileSystemQueryFlags }
