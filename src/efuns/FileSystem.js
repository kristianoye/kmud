/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 12, 2019
 * 
 * Helper methods for filesystem operations.
 */

const
    path = require('path');

class DeleteDirectoryOptions {
    /**
     * 
     * @param {number} flags
     */
    constructor(flags) {
        this.flags = flags;
    }

    /** Confirm each delete */
    static get PromptConfirm() { return 1 << 1; }

    /** Recursively delete */
    static get Recursive() { return 1 << 0; }

    /** Print out what is happening */
    static get Verbose() { return 1 << 2; }
}

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
     * Create a directory on the filesystem
     * @param {string} expr The path expression to create
     * @param {number} flags Flags to control the operation
     * @returns {Promise<boolean>} Returns true if successful
     */
    static async createDirectoryAsync(expr, flags = 0) {
        return await driver.fileManager.createDirectoryAsync(expr, flags);
    }

    /**
     * Delete a directory from the filesystem
     * @param {string} expr The path to delete^
     * @param {number|DeleteDirectoryOptions} flags Flags to control the operation
     * @returns {Promise<boolean>} Returns true if successful
     */
    static async deleteDirectoryAsync(expr, flags = 0) {
        return await driver.fileManager.deleteDirectory(expr, flags);
    }

    /** Options object for deleting directories */
    static get DeleteDirectoryOptions() {
        return DeleteDirectoryOptions;
    }

    /**
     * Get a directory object
     * @param {string} expr The directory expression to fetch
     * @param {any} flags Flags to control the operation
     */
    static async getDirectoryAsync(expr, flags = 0) {
        return await driver.fileManager.getDirectoryAsync(expr, flags);
    }

    /**
     * Get a file object
     * @param {string} expr The file expression to fetch
     * @param {any} flags Flags to control the operation
     */
    static async getFileAsync(expr, flags = 0) {
        return await driver.fileManager.getFileAsync(expr, flags);
    }

    /**
     * Get an object from the filesystem
     * @param {string} expr The path expression to get
     * @param {number} [flags] Optional flags to control the operation
     */
    static getObjectAsync(expr, flags = 0) {
        return driver.fileManager.getObjectAsync(expr, flags);
    }

    static async getFileACL(expr) {
        return await driver.fileManager.getFileACL(expr);
    }

    /**
     * Check to see if the file expression is a directory
     * @param {string} expr The path to check
     * @returns {Promise<boolean>} Returns promise to check directory status
     */
    static async isDirectoryAsync(expr) {
        return await driver.fileManager.isDirectoryAsync(expr);
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
        return await driver.fileManager.readFileAsync(expr);
    }

    /**
     * Read JSON from a stream
     * @param {string} expr The location to read from
     * @returns {Promise<object>} The resulting object
     */
    static readJsonAsync(expr) {
        return driver.fileManager.readJsonAsync(expr);
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
