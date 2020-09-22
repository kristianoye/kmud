
const
    DirFlags = Object.freeze({
        /** Do not cross filesystems */
        DontCrossFilesystems: 1 << 1,

        /** Create directory structure as needed */
        EnsurePathExists: 1 << 0,

        /** Recursive operation */
        RecursiveOperation: 1 << 2
    });

module.exports = function (system) {
    if (!system.flags) system.flags = {};
    if (!system.flags.fs) system.flags.fs = {};

    system.flags.fs.DirFlags = DirFlags;
};

