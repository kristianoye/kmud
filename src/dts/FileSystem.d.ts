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
     * Get a directory object based on the file expression
     * @param expr The file expression to resolve into a directory
     * @param flags Flags associated with the operation
     */
    getDirectoryAsync(expr: string, flags?: number): Promise<DirectoryObject>;

    /**
     * Get a directory object based on the provided expression.
     * @param expr The expression to evaluate
     * @param flags Flags to control the operation
     */
    getFileAsync(expr: string, flags?: number): Promise<FileSystemObject>;

    /**
     * Perform a glob operation with the given relative path/expression
     * @param dir The relative base directory to search from
     * @param expr The file expression to evaluate
     * @param options 
     */
    glob(dir: string, expr: string, options: Glob): FileSystemObject[];

    /** The mudlib path the filesystem is mounted to */
    mountPoint: string;

    /** For physical drives, the root is the native location of the root */
    root?: string;

    /**
     * Writes JSON to a stream
     * @param file The filename to write to
     * @param content The content to write.
     * @param flags Optional flags for the operation
     * @param encoding The encoding to use when writing (defaults to utf8)
     */
    writeJsonAsync(file: string, content: any, flags: number, encoding: string): Promise<boolean>;
}

declare interface FileSystemOptions {
    /** The maximum number of allows async operations per request */
    asyncReaderLimit: number;

    /** The MUD directory this filesystem is mounted to */
    mountPoint: string;

    /** The default encoding type for the filesystem */
    encoding: string;

    /** Flags indicating what operations the filesystem supports  */
    flags?: number;

    /** The physical root of this filesystem (valid only block devices) */
    root: string;

    /** The type of underlying filesystem (e.g. disk, database, block, etc) */
    type: string;

    /** The unique ID assigned to this filesystem */
    systemId: string;
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

    /**
     * Determine if the specified bitflag is active
     * @param flag The flag to test for
     */
    hasFlag(flag: number): boolean;
}

/** Base file system object */
declare interface FileSystemObject {
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
    parent: FileSystemObject;

    /** The full MUD file path to this item */
    path: string;

    /** Path relative to the root of the filesystem */
    relativePath: string;

    /** The size of the file object in bytes (-1 = does not exist, -2 = directory) */
    size: number;

    /** The user Id who owns the file */
    uid: number;

    deleteAsync(flags: number): Promise<boolean>;

    getParent(): Promise<FileSystemObject>;

    readAsync(): string | string[] | FileSystemObject[];
}

declare interface DirectoryObject extends FileSystemObject {
    /**
     * Read the content of the directory
     * @param pattern An optional file pattern to match (defaults to all)
     * @param options Additional operations to control operation
     */
    readAsync(pattern?: string, options?: number): FileSystemObject[];
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

/** The primary means of gaining access to the filesystem */
declare interface FileManager extends Helpers.FileSystem {

}