/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 12, 2019
 * 
 * Helper methods for filesystem operations.
 */

const
    path = require('path'),
    { CatFlags, CopyFlags, DeleteFlags, FileSystemQueryFlags } = require('../fs/FileSystemFlags'),
    { FileCopyOperation, FileDeleteOperation } = require('../fs/FileOperations'),
    { CallOrigin } = require('../ExecutionContext');
const { FileSystemObject } = require('../fs/FileSystemObject');
    

class FileSystemHelper {

    /**
     * Append content to a new or existing file.
     * @param {string} expr The filename expression
     * @param {any} content The content to write to filecreateFile
     * @param {string} encoding The file encoding to use
     */
    static appendFileAsync(expr, content, encoding) {
        return driver.fileManager.writeFileAsync(expr, content, 'a', encoding);
    }

    /**
     * Copy a file object
     * @param {string | FileCopyOperation} source
     * @param {string | FileCopyOperation} destination
     * @param {number | FileCopyOperation} options
     * @returns
     */
    static async copyAsync(source, destination, options) {
        /** @type {FileCopyOperation} */
        let opts = {
            source,
            destination,
            flags: 0
        };

        if (typeof source === 'object')
            opts = Object.assign(opts, source);
        if (typeof destination === 'object')
            opts = Object.assign(opts, destination);
        if (typeof options === 'object')
            opts = Object.assign(opts, options);

        if (typeof source === 'string')
            opts.source = source;
        if (typeof destination === 'string')
            opts.destination = destination;
        if (typeof options === 'number')
            opts.flags = options;

        try {
            return await driver.fileManager.copyAsync(opts);
        }
        catch (err) {
            if (opts.onCopyError) {
                opts.onCopyError(opts.verb, err);
            }
            else
                throw err;
        }
        return false;
    }

    static get CatFlags() {
        return CatFlags;
    }

    static get CopyFlags() {
        return CopyFlags;
    }

    static async createBackupAsync(fileOrPath, backupControl = 'simple', suffix = '~') {
        if (typeof fileOrPath === 'object' && typeof fileOrPath.fullPath === 'string')
            fileOrPath = fileOrPath.fullPath;

        let fso = await driver.fileManager.getObjectAsync(fileOrPath);
        if (!fso.exists)
            return '';

        let ext = await FileSystemHelper.getBackupExtension(fso, backupControl, suffix),
            backupTarget = await driver.fileManager.getObjectAsync(fso.fullPath + ext);
        if (await fso.copyAsync(backupTarget))
            return backupTarget;
        else
            return '';
    }

    /**
     * Create a directory on the filesystem
     * @param {string} expr The path expression to create
     * @param {number} flags Flags to control the operation
     * @returns {Promise<boolean>} Returns true if successful
     */
    static async createDirectoryAsync(expr, flags = 0) {
        return await driver.fileManager.createDirectoryAsync(expr, flags);
    }

    /**
     * 
     * @param {string} file
     * @param {number | FileDeleteOperation} options
     * @returns
     */
    static async deleteAsync(files, options) {
        /** @type {FileDeleteOperation} */
        let opts = {
            files,
            flags: 0
        };

        if (Array.isArray(files)) {
            opts.files = files.map(f => {
                if (typeof f === 'string')
                    return f;
                else if (f instanceof FileSystemObject)
                    return f.fullPath;
                else
                    return f;
            });
        }
        else if (typeof files === 'object') {
            if (files instanceof FileSystemObject)
                opts.files = [files.fullPath];
            else
                opts = Object.assign(opts, files);
        }
        if (typeof options === 'object')
            opts = Object.assign(opts, options);

        if (typeof files === 'string')
            opts.files = [files];

        if (typeof options === 'number')
            opts.flags = options;

        try {
            return await driver.fileManager.deleteAsync(opts);
        }
        catch (err) {
            if (opts.onDeleteFailure) {
                opts.onDeleteFailure(opts.verb, opts.files.join(', '), err);
            }
            else
                throw err;
        }
        return false;
    }

    static get DeleteFlags() {
        return DeleteFlags;
    }

    static get FileSystemQueryFlags() {
        return FileSystemQueryFlags;
    }

    static get BackupControl() {
        return BackupControl;
    }

    static async getBackupExtension(fileOrPath, control='simple', suffix='~') {
        if (typeof fileOrPath === 'object' && typeof fileOrPath.fullPath === 'string')
            fileOrPath = fileOrPath.fullPath;

        switch (control) {
            case 'never':
            case 'simple':
                return suffix;

            case 'none':
            case 'off':
                return '';

            case 'numbered':
            case 't':
                existing = await FileSystemHelper.queryFileSystemAsync(`${fileOrPath}.~*~`);
                if (existing && existing.length > 0) {
                    let maxId = existing
                        .map(fo => fo.extension.slice(1))
                        .filter(ext => !!ext)
                        .map(ext => parseInt(ext.split('~')[1]))
                        .filter(n => !isNaN(n) && n > 0)
                        .sort()
                        .pop();
                    return `.~${(maxId + 1)}~`;
                }
                else
                    return '.~1~';

            case 'existing':
                existing = await FileSystemHelper.queryFileSystemAsync(`${dest.fullPath}.~*`);
                if (existing && existing.length > 0) {
                    let maxId = existing
                        .map(fo => fo.extension.slice(1))
                        .filter(ext => !!ext)
                        .map(ext => parseInt(ext.split('~')[1]))
                        .filter(n => !isNaN(n) && n > 0)
                        .sort()
                        .pop();
                    if (maxId > 0)
                        return `.~${(maxId + 1)}~`;
                }
                return suffix;
        }
    }

    /**
     * Get a directory object
     * @param {string} expr The directory expression to fetch
     * @param {any} flags Flags to control the operation
     */
    static async getDirectoryAsync(expr, flags = 0) {
        let frame = driver.pushFrame({ method: 'getDirectoryAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let result = await driver.fileManager.getDirectoryAsync(expr, flags);
            return result;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Get a file object
     * @param {string} expr The file expression to fetch
     * @param {any} flags Flags to control the operation
     * @returns {Promise<FileSystemObject>}
     */
    static async getFileAsync(expr, flags = 0) {
        let frame = driver.pushFrame({ method: 'getFileAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let result = await driver.fileManager.getFileAsync(expr, flags);
            return result;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Get an object from the filesystem
     * @param {string} expr The path expression to get
     * @param {number} [flags] Optional flags to control the operation
     */
    static getObjectAsync(expr, flags = 0) {
        return driver.fileManager.getObjectAsync(expr, flags);
    }

    /**
     * Check to see if the file expression is a directory
     * @param {string} expr The path to check
     * @returns {Promise<boolean>} Returns promise to check directory status
     */
    static async isDirectoryAsync(expr) {
        let frame = driver.pushFrame({ method: 'isDirectoryAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let result = await driver.fileManager.getFileAsync(expr);
            return result && result.exists && result.isDirectory;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Query file system
     * @param {string} expr
     * @param {number} flags
     * @param {any} options
     */
    static queryFileSystemAsync(expr, flags = 0, options = {}) {
        let fullOptions = { expression: false, flags: 0 };

        if (typeof expr === 'object') {
            fullOptions = Object.assign({}, expr);
        }
        else if (typeof expr === 'string') {
            fullOptions.expression = expr;
        }
        else
            throw new Error(`queryFileSystem: Argument 1 must be string or object and not ${typeof expr}`);

        if (typeof flags === 'object') {
            fullOptions = Object.assign(fullOptions, flags);
        }
        else if (typeof flags === 'number') {
            fullOptions.flags = flags;
        }
        else
            throw new Error(`queryFileSystem: Argument 2 must be number or object and not ${typeof expr}`);

        if (typeof options === 'object') {
            fullOptions = Object.assign(fullOptions, options);
        }
        else
            throw new Error(`queryFileSystem: Argument 3 must be object and not ${typeof expr}`);

        return driver.fileManager.queryFileSystemAsync(fullOptions);
    }

    /**
     * Read a directory
     * @param {string} expr The path expression to read
     * @param {number} flags Flags to control the operation
     * @returns {Promise<string[]> | Promise<FileSystemObject[]>} Returns directory contents
     */
    static async readDirectoryAsync(expr, flags = 0) {
        return await driver.fileManager.readDirectoryAsync(expr, flags);
    }

    /**
     * Read a file
     * @param {string} expr Read the contents of a file
     * @param {string} [encoding] The optional encoding to use
     * @param {number} [flags] 
     */
    static async readFileAsync(expr, encoding = 'utf8', flags = 0) {
        return await driver.fileManager.readFileAsync(expr, encoding, flags);
    }

    /**
     * Read JSON from a stream
     * @param {string} expr The location to read from
     * @param {FileOptions} options Additional options for the operation
     * @returns {Promise<object>} The resulting object
     */
    static async readJsonAsync(expr, options = {}) {
        let ecc = driver.getExecution();
        let frame = ecc.pushFrame(driver.masterObject, 'readJsonAsync', __filename, true, 179, false);
        try {
            let result = await driver.fileManager.readJsonAsync(expr, options);
            return result;
        }
        catch (err) {
            throw err;
        }
        finally {
            ecc.pop(frame);
        }
    }

    /**
     * Read a YAML file 
     * @param {string} expr The file to read from
     */
    static readYamlAsync(expr) {
        return driver.fileManager.readYamlAsync(expr);
    }

    static relativePath(expr, cwd = false) {
        let tp = driver.efuns.thisPlayer();

        return path.posix.relative(expr, cwd);
    }

    /**
     * Stat a file location
     * @param {string} expr
     * @param {number} [flags] Optional flags to use when fetching file data.
     */
    static async statAsync(expr, flags = 0) {
        return await driver.fileManager.statAsync(expr, flags);
    }

    /**
     * Write content to a file
     * @param {string} expr The file to write to
     * @param {string|Buffer} content The content to write to the file
     * @param {number} flags Flags to control the operation
     * @param {string} encoding The encoding to use when writing the file (defaults to utf8)
     */
    static async writeFileAsync(expr, content = '', flags = 0, encoding = 'utf8') {
        return await driver.fileManager.writeFileAsync(expr, content, flags, encoding);
    }

    /**
     * Write JSON to a file or stream
     * @param {string} expr The path expression to write to
     * @param {any} content The data to write to the path expression
     * @param {number} [flags] Flags to control the write operation
     * @param {string} [encoding] The encoding to use when writing the file
     */
    static async writeJsonAsync(expr, content = {}, flags = 0, encoding = 'utf8') {
        return await driver.fileManager.writeJsonAsync(expr, content, flags, encoding);
    }
}

module.exports = FileSystemHelper;
