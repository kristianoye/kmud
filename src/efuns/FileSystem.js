/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 12, 2019
 * 
 * Helper methods for filesystem operations.
 */

const
    path = require('path');

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

    static async createDirectoryAsync(expr, flags = 0) {
        return await driver.fileManager.createDirectoryAsync(expr, flags);
    }

    static createDirectorySync(expr, flags = 0) {
        return driver.fileManager.createDirectorySync(expr, flags);
    }

    static async deleteDirectoryAsync(expr, flags = 0) {
        return await driver.fileManager.deleteDirectory(expr, flags);
    }

    static deleteDirectorySync(expr, flags = 0) {
        return driver.fileManager.deleteDirectorySync(expr, flags);
    }

    static async getFileACL(expr) {
        return await driver.fileManager.getFileACL(expr);
    }

    static async isDirectoryAsync(expr) {
        return await driver.fileManager.isDirectoryAsync(expr);
    }

    static readJsonAsync(expr) {
        return driver.fileManager.readJsonAsync(expr);
    }

    static async readDirectoryAsync(expr, flags = 0) {
        return await driver.fileManager.readDirectoryAsync(expr, flags);
    }

    static readDirectorySync(expr, flags = 0) {
        return driver.fileManager.readDirectorySync(expr, flags);
    }

    static relativePath(expr, cwd = false) {
        let tp = driver.efuns.thisPlayer();
        let currentPath = cwd || !!tp && tp.applyGetWorkingDir();

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
     * Stat a file syncronously
     * @param {string} expr
     * @param {number} flags
     */
    static statSync(expr, flags = 0) {
        return driver.fileSystem.statSync(expr, flags);
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
