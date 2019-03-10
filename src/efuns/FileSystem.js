/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 12, 2019
 * 
 * Helper methods for filesystem operations.
 */

class FileSystemHelper {
    static createDirectoryAsync(expr, flags = 0) {
        return driver.fileManager.createDirectoryAsync(efuns, expr, flags);
    }

    static isDirectoryAsync(expr) {
        return driver.fileManager.isDirectoryAsync(efuns, expr);
    }
}

module.exports = FileSystemHelper;
