/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides an abstraction for the MUD filesystems.
 * - File manager creates a stat object,
 *   - Security manager checks to see if the caller has permission,
 *     - File system performs the operation.
 *       - Security system validates the results and returns
 */
class FileSystemStat {
    constructor(fileSystem) {
    }

    /**
     * Checks to see if the path exists.
     * @returns {boolean} Indicates whether the path exists.
     */
    doesExist() {
        return false;
    }

    getAccessDate() {
    }

    getCreateDate() {
    }

    getModifyDate() {
    }

    /**
     * Get the parent of this object.
     * @returns {FileSystemStat} Returns the stat data of the parent.
     */
    getParent() {
        return null;
    }

    isDirectory() {
    }

    isFile() {
    }

    isSystemFile() {

    }
}

module.exports = FileSystemStat;
