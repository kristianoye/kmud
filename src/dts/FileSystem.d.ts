/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2020.  All rights reserved.
 * Date: January 27, 2020
 */

/** Supported file encodings */
declare enum FileEncoding {
    ASCII = 'ascii',
    Binary = 'binary',
    Latin1 = 'latin1',
    UTF8 = 'utf8'
}

/** Basic FileSystem interface */
declare interface FileSystem {

    /** The native encoding type for the filesystem (default: utf8) */
    encoding: FileEncoding;

    /** The mudlib path the filesystem is mounted to */
    mountPoint: string;

    /** For physical drives, the root is the native location of the root */
    root?: string;
}

/** Base file system object */
declare interface FileSystemStat {
    /** The access timestamp */
    atime: Date;

    /** The actual date the file was created */
    birthtime: Date;

    /** The birthday represented in miliseconds */
    birthtimeMs: number;

    /** The number of blocks consumed by this file object */
    blocks: number;

    /** The size of a single block on the device (if it is a block device) */
    blockSize: number;

    /** The creation time */
    ctime: Date;

    /** The creation time represented in miliseconds */
    ctimeMs: number;

    /** The default MUD group for this object */
    defaultGroup: string;

    /** The device ID on which this object exists */
    dev: number;

    /** Does the specified object exist on the filesystem */
    exists: boolean;

    /** The group ID */
    gid: number;

    /** The inode--generally not used */
    ino: number;

    /** Indicates whether the entry is a directory */
    isDirectory: boolean;

    /** Indicates whether the entry is a regular file */
    isFile: boolean;

    /** The modify time */
    mtime: Date;

    /** The modify time in miliseconds */
    mtimeMs: number;

    /** Number of hard links to this file */
    nlink: number;

    /** The file owner */
    owner: string;

    /** The parent file object */
    parent: FileSystemStat;

    /** The full MUD file path to this item */
    path: string;

    /** The size of the file object in bytes (-1 = does not exist, -2 = directory) */
    size: number;

    /** The user Id who owns the file */
    uid: number;
}