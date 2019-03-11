/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: Provides a filesystem abstraction for the web server.
 */

const
    path = require('path'),
    fs = require('fs');

class FileAbstractionBase {
    /**
     * Construct an abstraction
     * @param {Object.<string,string>} mapping
     */
    constructor() {
        /** 
         * Maps alternate location for certain files.
         * @type {Object.<string,string>}
         */
        this.fileMappings = {};
        this.fileMappingNames = [];
    }

    addMapping(target, destination) {
        if (typeof target === 'object') {
            Object.keys(target).forEach(key => {
                if (target.hasOwnProperty(key)) {
                    this.fileMapping[key] = target[key];
                }
            });
        }
        else if (typeof target === 'string')
            this.fileMappings[target] = destination;

        this.fileMappingNames = Object.keys(this.fileMappings).sort((a, b) => {
            return a.split('/').length > b.split('/').length ? -1 : 1;
        });
        return this;
    }

    async readDirectory(expr) {
        throw new Error('Not implemented');
    }

    async readFile(expr) {
        throw new Error('Not implemented');
    }

    /**
     * Resolve any mapped paths to their actual destinations.
     * @param {string} expr The expression to try and translate.
     * @returns {string} Returns the actual filename to use for the request.
     */
    resolve(expr) {
        for (let i = 0, max = this.fileMappingNames.length; i < max; i++) {
            let name = this.fileMappingNames[i];

            if (expr.startsWith(name)) {

            }
        }
        return expr;
    }

    async stat(expr) {
        throw new Error('Not implemented');
    }
}

FileAbstractionBase.createDummyStats = function (err = false) {
    let dt = new Date(0),
        alwaysFalse = () => false;

    return {
        atime: dt,
        atimeMs: dt.getTime(),
        birthtime: dt,
        birthtimeMs: dt.getTime(),
        blksize: 4096,
        blocks: 0,
        ctime: dt,
        ctimeMs: dt.getTime(),
        dev: -1,
        error: err || new Error('Unknown error'),
        exists: false,
        gid: -1,
        ino: -1,
        nlink: -1,
        uid: -1,
        mode: -1,
        mtime: dt,
        mtimeMs: dt.getTime(),
        size: -1,
        rdev: -1,
        isBlockDevice: alwaysFalse,
        isCharacterDevice: alwaysFalse,
        isDirectory: alwaysFalse,
        isFIFO: alwaysFalse,
        isFile: alwaysFalse,
        isSocket: alwaysFalse,
        isSymbolicLink: alwaysFalse
    };
};

class FileAbstractionDefault extends FileAbstractionBase {
    /**
     * Read a directory (supports wildcards)
     * @param {string} expr The directory expression to read.
     * @returns {Promise<string[]>} Returns a promise that returns a list of filenames.
     */
    async readDirectory(expr) {
        let dir = expr;
        /** @type {RegExp} */
        let pat;

        if (/\?\*/.test(expr)) {
            let n = expr.lastIndexOf(path.sep),
                localFile = expr.slice(n + 1)
                    .replace(/\./g, '\\.')
                    .replace(/\*/g, '.+')
                    .replace(/\?/g, '.');

            dir = expr.slice(0, n);
            pat = new RegExp('^' + localFile + '$');
        }

        return new Promise((resolve) => {
            try {
                fs.readdir(dir, (err, fileList) => {
                    if (err) resolve(err);

                    if (pat)
                        resolve(fileList.filter(fn => pat.test(fn)));
                    else
                        resolve(fileList);
                });
            }
            catch (err) {
                resolve(err);
            }
        });
    }

    /**
     * Read a file from underlying storage
     * @param {string} expr The file expression to read
     * @param {string} encoding Optional encoding to convert the file to
     * @returns {Promise<string|Buffer>} Returns a promise of a buffer or a string.
     */
    async readFile(expr, encoding = false) {
        return new Promise((resolve) => {
            try {
                fs.readFile(expr, (err, buffer) => {
                    if (err) 
                        resolve(err);
                    else if (encoding) 
                        resolve(buffer.toString(encoding))
                    else {
                        resolve(buffer);
                    }
                });
            }
            catch (err) {
                resolve(err);
            }
        });
    }

    /**
     * Attempt to stat a file
     * @param {string} expr The file expression to stat
     * @returns {Promise<fs.Stats & { exists: boolean }>} Return information about a file.
     */
    async stat(expr) {
        return new Promise((resolve) => {
            try {
                fs.stat(expr, (err, stat) => {
                    if (err) {
                        resolve(FileAbstractionBase.createDummyStats(err));
                    }
                    else {
                        resolve(Object.assign(stat, { exists: true }));
                    }
                });
            }
            catch (err) {
                resolve(FileAbstractionBase.createDummyStats(err));
            }
        });
    }
}

module.exports = { FileAbstractionBase, FileAbstractionDefault };

