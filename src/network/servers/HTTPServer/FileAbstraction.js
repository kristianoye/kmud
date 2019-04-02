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

class FileLocation {
    /**
     * @param {FileAbstractionBase} abs The file abstraction that created the object.
     * @param {string} vp The virtual path
     * @param {string} pp The physical path
     */
    constructor(abs, vp, pp) {
        this.creator = abs;
        this.virtualPath = vp;
        this.physicalPath = pp;
    }

    /**
     * Resolve a relative virtual path
     * @param {string} vp The relative virtual path
     * @returns {FileLocation} The new file location
     */
    resolveVirtual(vp) {
        let virtualPath = path.posix.join(this.virtualPath, vp),
            physicalPath = this.creator.resolve(virtualPath);

        return new FileLocation(this.creator, virtualPath, physicalPath);
    }

    async stat() {
        if (typeof this._stat !== 'undefined')
            return this._stat;

        return this._stat = await this.creator.stat(this.physicalPath);
    }
}

class FileAbstractionBase {
    /**
     * Construct an abstraction
     * @param {Object.<string,string>} mapping
     */
    constructor(contentRoot) {
        /** 
         * Maps alternate location for certain files.
         * @type {Object.<string,string>}
         */
        this.fileMappings = {};
        this.fileMappingNames = [];
        this.indexFiles = [];
        this.contentRoot = contentRoot || false;
    }

    addIndexFile(...index) {
        index.forEach(fn => {
            if (typeof fn === 'string' && fn.length > 0 && this.indexFiles.indexOf(fn) === -1)
                this.indexFiles.push(fn);
        });
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

    /**
     * Create a location object.
     * @param {string} virtualPath The virtual path
     * @returns {FileLocation} The file location object mapping a virtual path to a physical path.
     */
    createLocation(virtualPath) {
        if (virtualPath.charAt(0) !== '/')
            throw new Error(`Virtual path (${virtualPath}) must start with /`);
        for (let i = 0; i < this.fileMappingNames.length; i++) {
            let name = this.fileMappingNames[i];
            if (virtualPath.startsWith(name)) {
                let mappedPath = path.join(this.fileMappings[name], virtualPath.slice(name.length));
                return new FileLocation(this, virtualPath, mappedPath);
            }
        }
        let physicalPath = path.join(this.contentRoot, virtualPath.slice(1));
        return new FileLocation(this, virtualPath, physicalPath);
    }

    async readDirectory(expr, isMapped = undefined) {
        throw new Error('Not implemented');
    }

    async readFile(expr, isMapped = undefined) {
        throw new Error('Not implemented');
    }

    /**
     * Attempt to read a location for a physical file.
     * @param {string} expr The file expression to stat
     * @param {boolean} isMapped Has the location already been mapped?
     * @returns {Promise<fs.Stats & { exists: boolean }>} Return information about a file.
     */
    async readLocation(expr, isMapped = undefined) {
        throw new Error('Not implemented');
    }

    /**
     * Resolve any mapped paths to their actual destinations.
     * @param {string} expr The expression to try and translate.
     * @returns {string} Returns the location to use and a flag indicating if the file was mapped.
     */
    resolve(expr) {
        for (let i = 0, max = this.fileMappingNames.length; i < max; i++) {
            let name = this.fileMappingNames[i];

            if (expr.startsWith(name)) {
                let rightPart = expr.slice(this.fileMappings[name].length);
                let newPath = path.posix.join(this.fileMappings[name], rightPart.slice(1));
                return newPath;
            }
        }
        return path.join(this.contentRoot, expr.slice(1));
    }

    /**
     * Replace the content root directory.
     * @param {string} root The content root directory
     * @returns {FileAbstractionBase} 
     */
    setContentRoot(root) {
        this.contentRoot = root;
        return this;
    }

    /**
     * Attempt to stat a file
     * @param {string} expr The file expression to stat
     * @param {boolean} isMapped Has the location already been mapped?
     * @returns {Promise<fs.Stats & { exists: boolean }>} Return information about a file.
     */
    async stat(expr, isMapped = undefined) {
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
    async readDirectory(expr, isMapped = undefined) {
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
    async readFile(expr, encoding = false, isMapped = undefined) {
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
     * @param {boolean} isMapped Has the location already been mapped?
     * @returns {Promise<fs.Stats & { exists: boolean }>} Return information about a file.
     */
    async stat(expr, isMapped = undefined) {
        return new Promise((resolve) => {
            try {
                fs.stat(expr, (err, stat) => {
                    if (err) {
                        resolve(FileAbstractionBase.createDummyStats(err, expr));
                    }
                    else {
                        resolve(Object.assign(stat, {
                            exists: true,
                            fullPath: expr
                        }));
                    }
                });
            }
            catch (err) {
                resolve(FileAbstractionBase.createDummyStats(err, expr));
            }
        });
    }
}

module.exports = { FileAbstractionBase, FileAbstractionDefault };

