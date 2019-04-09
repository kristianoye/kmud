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
}

module.exports = FileSystemHelper;
