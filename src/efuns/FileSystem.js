/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 12, 2019
 * 
 * Helper methods for filesystem operations.
 */

const
    { CatFlags, CopyFlags, DeleteFlags, FileSystemQueryFlags } = require('../fs/FileSystemFlags'),
    { FileCopyOperation, FileDeleteOperation } = require('../fs/FileOperations'),
    { CallOrigin, ExecutionContext } = require('../ExecutionContext'),
    { FileSystemObject } = require('../fs/FileSystemObject'),
    path = require('path').posix;


class FileSystemHelper {
    constructor(parent) {
        this.efuns = parent;
    }

    /**
     * Append content to a new or existing file.
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The filename expression
     * @param {any} content The content to write to filecreateFile
     * @param {string} encoding The file encoding to use
     */
    async appendFileAsync(ecc, expr, content, options = { encoding: 'utf8' }) {
        let frame = ecc.push({ file: __filename, method: 'appendFileAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let
                absPath = path.resolve(this.efuns.directory, expr),
                fso = await driver.fileManager.getObjectAsync(frame.branch(), absPath);
            return await fso.appendFileAsync(frame.branch(), content, options);
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Copy a file object
     * @param {ExecutionContext} ecc The current call stack
     * @param {string | FileCopyOperation} source
     * @param {string | FileCopyOperation} destination
     * @param {number | FileCopyOperation} options
     * @returns
     */
    async copyAsync(ecc, source, destination, options) {
        let frame = ecc.push({ file: __filename, method: 'copyAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
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
                return await driver.fileManager.copyAsync(frame.branch(), opts);
            }
            catch (err) {
                if (opts.onCopyError) {
                    opts.onCopyError(frame.branch(), opts.verb, err);
                }
                else
                    throw err;
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    get CatFlags() {
        return CatFlags;
    }

    get CopyFlags() {
        return CopyFlags;
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current call stack
     * @param {any} fileOrPath
     * @param {any} backupControl
     * @param {any} suffix
     * @returns
     */
    async createBackupAsync(ecc, fileOrPath, backupControl = 'simple', suffix = '~') {
        let frame = ecc.push({ file: __filename, method: 'createBackupAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            if (typeof fileOrPath === 'object' && typeof fileOrPath.fullPath === 'string')
                fileOrPath = fileOrPath.fullPath;

            let fso = await driver.fileManager.getObjectAsync(frame.branch(), fileOrPath);
            if (!fso.exists)
                return '';

            let ext = await this.getBackupExtension(frame.branch(), fso, backupControl, suffix),
                backupTarget = await driver.fileManager.getObjectAsync(frame.branch(), fso.fullPath + ext);
            if (await fso.copyAsync(frame.branch(), backupTarget))
                return backupTarget;
            else
                return '';
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Create a directory on the filesystem
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The path expression to create
     * @param {{ createAsNeeded: boolean, errorIfExists: boolean }} flags Flags to control the operation
     * @returns {Promise<boolean>} Returns true if successful
     */
    async createDirectoryAsync(ecc, expr, { createAsNeeded, errorIfExists } = { createAsNeeded: false, errorIfExists: true }) {
        let frame = ecc.push({ file: __filename, method: 'createDirectoryAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let fso = await driver.fileManager.getObjectAsync(frame.context, expr);
            return await fso.createDirectoryAsync(frame.context, { createAsNeeded, errorIfExists });
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} file
     * @param {number | FileDeleteOperation} options
     * @returns
     */
    async deleteAsync(ecc, files, options) {
        let frame = ecc.push({ file: __filename, method: 'deleteAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
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
        finally {
            frame.pop();
        }
    }

    get DeleteFlags() {
        return DeleteFlags;
    }

    get FileSystemQueryFlags() {
        return FileSystemQueryFlags;
    }

    get BackupControl() {
        return BackupControl;
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current call stack
     * @param {any} fileOrPath
     * @param {any} control
     * @param {any} suffix
     * @returns
     */
    async getBackupExtension(ecc, fileOrPath, control = 'simple', suffix = '~') {
        let frame = ecc.push({ file: __filename, method: 'getBackupExtension', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
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
        finally {
            frame.pop();
        }
    }

    /**
     * Get a directory object
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The directory expression to fetch
     * @param {any} flags Flags to control the operation
     */
    async getDirectoryAsync(ecc, expr, flags = 0) {
        let frame = ecc.push({ file: __filename, method: 'getDirectoryAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let result = await driver.fileManager.getObjectAsync(frame.branch(), expr, flags);
            if (!result.isDirectory)
                throw new Error(`getDirectoryAsync(): '${expr}' is not a valid directory`);
            return result;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Get a file object
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The file expression to fetch
     * @param {any} flags Flags to control the operation
     * @returns {Promise<FileSystemObject>}
     */
    async getFileAsync(ecc, expr, flags = 0) {
        let frame = ecc.push({ file: __filename, method: 'getFileAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let result = await driver.fileManager.getObjectAsync(frame.branch(), expr, flags);
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
    async getObjectAsync(ecc, expr, flags = 0) {
        let frame = ecc.push({ file: __filename, method: 'getObjectAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            return await driver.fileManager.getObjectAsync(frame.branch(), expr, flags);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Check to see if the file expression is a directory
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The path to check
     * @returns {Promise<boolean>} Returns promise to check directory status
     */
    async isDirectoryAsync(ecc, expr) {
        let frame = ecc.push({ file: __filename, method: 'isDirectoryAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let result = await driver.fileManager.getObjectAsync(frame.branch(), expr);
            return result && result.exists && result.isDirectory;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Query file system
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr
     * @param {number} flags
     * @param {any} options
     */
    queryFileSystemAsync(ecc, expr, flags = 0, options = {}) {
        let frame = ecc.push({ file: __filename, method: 'queryFileSystemAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
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

            return driver.fileManager.queryFileSystemAsync(frame.branch(), fullOptions);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Read a directory
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The path expression to read
     * @param {number} flags Flags to control the operation
     * @returns {Promise<string[]> | Promise<FileSystemObject[]>} Returns directory contents
     */
    async readDirectoryAsync(ecc, expr, flags = 0) {
        let frame = ecc.push({ method: 'readDirectoryAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            return await driver.fileManager.readDirectoryAsync(expr, flags);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Read a file
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr Read the contents of a file
     * @param {string} [encoding] The optional encoding to use
     * @param {number} [flags] 
     * @returns {Promise<string>}
     */
    async readFileAsync(ecc, expr, options = {}) {
        let frame = ecc.push({ method: 'readFileAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let fso = await driver.fileManager.getObjectAsync(frame.branch(), expr);
            return await fso.readFileAsync(frame.branch(), options);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Read JSON from a stream
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The location to read from
     * @param {FileOptions} options Additional options for the operation
     * @returns {Promise<object>} The resulting object
     */
    async readJsonAsync(ecc, expr, options = {}) {
        let frame = ecc.push({ method: 'readJsonAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let fso = await driver.fileManager.getObjectAsync(frame.branch(), expr);
            return await fso.readJsonAsync(frame.branch(), options);
        }
        finally {
            ecc.pop(frame);
        }
    }

    /**
     * Read a YAML file 
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The file to read from
     */
    async readYamlAsync(ecc, expr) {
        let frame = ecc.push({ file: __filename, method: 'readYamlAsync', callType: CallOrigin.DriverEfun });
        try {
            let fso = await driver.fileManager.getObjectAsync(frame.branch(), expr);
            return await fso.readYamlAsync(frame.branch());
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Write content to a file
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The file to write to
     * @param {string|Buffer} content The content to write to the file
     * @param {number} flags Flags to control the operation
     * @param {string} encoding The encoding to use when writing the file (defaults to utf8)
     */
    async writeFileAsync(ecc, expr, content, flags = 0, encoding = 'utf8') {
        let frame = ecc.push({ file: __filename, method: 'writeFileAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let fso = await driver.fileManager.getObjectAsync(frame.branch(), expr);
            return await fso.writeFileAsync(frame.branch(), content, options)
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Write JSON to a file or stream
     * @param {ExecutionContext} ecc The current call stack
     * @param {string} expr The path expression to write to
     * @param {any} content The data to write to the path expression
     * @param {number} [flags] Flags to control the write operation
     * @param {string} [encoding] The encoding to use when writing the file
     */
    async writeJsonAsync(ecc, expr, content, options = { indent: true, encoding: 'utf8' }) {
        let frame = ecc.push({ file: __filename, method: 'writeJsonAsync', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            let fso = await driver.fileManager.getObjectAsync(frame.branch(), expr);
            return await fso.writeJsonAsync(frame.branch(), content, options)
        }
        finally {
            frame.pop();
        }
    }
}

module.exports = FileSystemHelper;
