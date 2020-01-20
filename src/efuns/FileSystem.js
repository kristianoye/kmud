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
     * @param {any} content The content to write to file
     * @param {string} encoding The file encoding to use
     */
    static appendFileAsync(expr, content, encoding) {
        return driver.fileManager.writeFileAsync(efuns, expr, content, 'a', encoding);
    }

    static async createDirectoryAsync(expr, flags = 0) {
        return await driver.fileManager.createDirectoryAsync(efuns, expr, flags);
    }

    static createDirectorySync(expr, flags = 0) {
        return driver.fileManager.createDirectorySync(efuns, expr, flags);
    }

    static async deleteDirectoryAsync(expr, flags = 0) {
        return await driver.fileManager.deleteDirectory(efuns, expr, flags);
    }

    static deleteDirectorySync(expr, flags = 0) {
        return driver.fileManager.deleteDirectorySync(efuns, expr, flags);
    }

    static async getFileACL(expr) {
        return await driver.fileManager.getFileACL(efuns, expr);
    }

    static async isDirectoryAsync(expr) {
        return await driver.fileManager.isDirectoryAsync(efuns, expr);
    }

    static readJsonFileAsync(expr) {
        return driver.fileManager.readJsonFileAsync(efuns, expr);
    }

    static async readDirectoryAsync(expr, flags = 0) {
        return await driver.fileManager.readDirectoryAsync(efuns, expr, flags);
    }

    static readDirectorySync(expr, flags = 0) {
        return driver.fileManager.readDirectorySync(efuns, expr, flags);
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
        return await driver.fileManager.statAsync(this, expr, flags);
    }

    /**
     * Stat a file syncronously
     * @param {string} expr
     * @param {number} flags
     */
    static statSync(expr, flags = 0) {
        return driver.fileSystem.statSync(efuns, expr, flags);
    }

    /**
     * Write content to a file
     * @param {string} expr The file to write to
     * @param {string|Buffer} content
     * @param {number} flags
     * @param {string} encoding
     */
    static async writeFileAsync(expr, content = '', flags = 0, encoding = 'utf8') {
        return await driver.fileManager.writeFileAsync(efuns, expr, content, flags, encoding);
    }
}

module.exports = FileSystemHelper;
