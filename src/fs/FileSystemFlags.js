/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 12, 2019
 * 
 * Helper methods for filesystem operations.
 */

const
    BackupControl = Object.freeze({
        Existing: 'existing',
        Simple: 'simple',
        None: 'none',
        Numbered: 'numbered'
    }),
    CopyFlags = Object.freeze({
        Force: 1 << 0,
        Interactive: 1 << 1,
        NonClobber: 1 << 2,
        Recursive: 1 << 3,
        Update: 1 << 4,
        Verbose: 1 << 5,
        SingleFilesystem: 1 << 6,
        RemoveDestination: 1 << 7,
        RemoveSlash: 1 << 8,
        Backup: 1 << 9,
        NoTargetDir: 1 << 10,
        NoPerms: 1 << 11
    }),
    DeleteOptions = Object.freeze({
        Force: 1 << 0,
        Interactive: 1 << 1
    }),
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

module.exports = { BackupControl, CopyFlags, DeleteOptions, FileSystemQueryFlags }
