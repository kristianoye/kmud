/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 12, 2019
 * 
 * Helper methods for filesystem operations.
 */

class FileSystemHelper {
    static isDirectoryAsync(path) {
        return driver.fileManager.isDirectoryAsync(efuns, path);
    }
}

module.exports = FileSystemHelper;
