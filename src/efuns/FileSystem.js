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

    static createDirectoryAsync(expr, flags = 0) {
        return driver.fileManager.createDirectoryAsync(efuns, expr, flags);
    }

    static isDirectoryAsync(expr) {
        return driver.fileManager.isDirectoryAsync(efuns, expr);
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
    static statAsync(expr, flags = 0) {
        return driver.fileManager.statAsync(this, expr, flags);
    }

    static writeFileAsync(expr, content, flags, encoding) {
        return driver.fileManager.writeFileAsync(efuns, expr, content, flags, encoding);
    }
}

module.exports = FileSystemHelper;
