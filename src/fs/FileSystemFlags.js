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
    CatFlags = Object.freeze({
        ShowLineNumbers: 1 << 0,
        ShowNonBlankLineNumbers: 1 << 1,
        ShowEndOfLine: 1 << 2,
        ShowNonPrinting: 1 << 5,
        ShowTabs: 1 << 3,
        SqueezeBlanks: 1 << 4,
        All: 1 << 2 | 1 << 3 | 1 << 5
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
        NoPerms: 1 << 11,
        NoFileClone: 1 << 12
    }),
    DeleteFlags = Object.freeze({
        Force: 1 << 0,
        Interactive: 1 << 1,
        RemoveEmpty: 1 << 2,
        Recursive: 1 << 3,
        SingleFilesystem: 1 << 4,
        SmartPrompt: 1 << 5,
        Verbose: 1 << 6
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

module.exports = { BackupControl, CatFlags, CopyFlags, DeleteFlags, FileSystemQueryFlags }
