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

    /**
     * Perform a glob operation with the given relative path/expression
     * @param dir The relative base directory to search from
     * @param expr The file expression to evaluate
     * @param options 
     */
    async glob(dir: string, expr: string, options: Glob): FileSystemStat[];

    /** The mudlib path the filesystem is mounted to */
    mountPoint: string;

    /** For physical drives, the root is the native location of the root */
    root?: string;
}

declare interface FileSystemRequest {
    /** Additional flags passed during the request */
    flags: number;

    /** The full MUD path being requested */
    readonly fullPath: string;

    /** The name of the file */
    readonly name: string;

    /** The operation being performed */
    readonly op: string;

    /** The path relative to the root of the filesystem */
    readonly relativePath: string;
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

    /** The content from the object (if requested) */
    content: string | object;

    /** The creation time */
    ctime: Date;

    /** The creation time represented in miliseconds */
    ctimeMs: number;

    /** Default file encoding */
    defaultEncoding: string;

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

    /** Is the object a block device? */
    isBlockDevice: boolean;

    /** Is the object a character device? */
    isCharacterDevice: boolean;

    /** Indicates whether the entry is a directory */
    isDirectory: boolean;

    /** Is the object a First-In, First-Out pipe? */
    isFIFO: boolean;

    /** Indicates whether the entry is a regular file */
    isFile: boolean;

    /** Is the item a socket? */
    isSocket: boolean;

    /** Is the object a link? */
    isSymbolicLink: boolean;

    /** The modify time */
    mtime: Date;

    /** The modify time in miliseconds */
    mtimeMs: number;

    /** The name of the file object */
    name: string;

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

declare interface DirectoryObject extends FileSystemStat {
    /**
     * Read the content of the directory
     * @param pattern An optional file pattern to match (defaults to all)
     * @param options Additional operations to control operation
     */
    read(pattern: string = '*', options: Glob = Glob.NoOptions): FileSystemStat[];
}

declare enum Glob {
    /** No options */
    NoOptions = 0,

    /** Glob recursively */
    Recursive = 1 << 0,

    /** Do not span filesystems */
    SameFilesystem = 1 << 1,

    /** Include hidden files */
    IncludeHidden = 1 << 2
}

declare enum StatFlags {
    /** No special requests */
    None = 0,

    /** Make sure to get the size */
    Size = 1 << 9,

    /** Get the ACL */
    Perms = 1 << 10,

    /** Return the object's content */
    Content = 1 << 9 | 1 << 10
}
