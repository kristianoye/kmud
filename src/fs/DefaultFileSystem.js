/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    { FileSystem, FileSystemStat } = require('../FileSystem'),
    FileManager = require('../FileManager'),
    async = require('async'),
    MXC = require('../MXC'),
    path = require('path'),
    fs = require('fs');

class DefaultFileSystem extends FileSystem {
    /**
     * 
     * @param {FileManager} fm The filemanager instance
     * @param {Object.<string,any>} options Dictionary containing options.
     */
    constructor(fm, options) {
        super(fm, options);

        /** @type {number} */
        this.asyncReaderLimit = options.asyncReaderLimit > 0 ? options.asyncReaderLimit : 10;

        /** @type {string} */
        this.root = path.resolve(fm.mudlibRoot, options.path);

        /** @type {number} */
        this.flags = FileSystem.FS_ASYNC |
            FileSystem.FS_SYNC |
            FileSystem.FS_DIRECTORIES |
            FileSystem.FS_OBJECTS | 
            FileSystem.FS_WILDCARDS;

        if (options.readOnly === true)
            this.flags |= FileSystem.FS_READONLY;

        /** @type {boolean} */
        this.autoStripBOM = typeof options.autoStripBOM === 'boolean' ?
            options.autoStripBOM : true;

        switch (path.sep) {
            case '\\':
                this.normalizer = /\\/g;
                break;
            default:
                this.normalizer = false;
                break;
        }

        /** @type {RegExp} */
        this.translator = new RegExp(/\//g);

        /** @type {string} */
        this.type = 'MUDFS';
    }

    /**
     * Convert the virtual path to a real path.
     * @param {FileSystemRequest|string} req The file expression to convert.
     * @returns {string} The absolute filesystem path.
     */
    getRealPath(req) {
        return path.resolve(this.root, typeof req === 'string' ? req : req.relativePath);
    }

    /**
     * Appends content to a file asyncronously.
     * @param {FileSystemRequest} req The file to write to.
     * @param {string|Buffer} content The content to write to file.
     * @param {function(boolean,Error):void} callback Callback that fires to indicate success or failure.
     * @returns {string} Returns the absolute path of the file that was written to.
     */
    appendFileAsync(req, content, callback) {
        return this.translatePath(req.relativePath, fullPath => {
            return fs.writeFile(filepath, content, {
                encoding: this.encoding || 'utf8',
                flag: 'a'
            }, MXC.awaiter(err => {
                let ctx = driver.getContext();
                return ctx.aborted ?
                    callback(false, new Error('Aborted')) :
                    callback(!err, err);
            }));
        });
    }

    /**
     * Appends content to a file syncronously.
     * @param {FileSystemRequest} req The filesystem request.
     * @param {string|Buffer} content The content to write to file.
     * @returns {string} The absolute path to the file.
     */
    appendFileSync(req, content) {
        return this.translatePath(req.relativePath, fullPath => {
            let stat = this.statSync(fullPath);
            if (stat.isDirectory)
                throw new Error(`appendFile: ${req.fullPath} is a directory`);
            return fs.writeFileSync(fullPath, content, {
                encoding: this.encoding || 'utf8',
                flag: 'a'
            });
        });
    }

    /**
     * 
     * @param {FileSystemRequest} req The filesystem request
     * @param {object} args Constructor args
     * @param {function(MUDObject,Error):void} callback The callback to receive the result
     */
    cloneObjectAsync(req, args, callback) {
        if (!this.assertAsync(FileSystem.FS_ASYNC))
            callback(false, new Error('Filesystem does not support async'));
    }

    /**
     * Clone an object syncronously.
     * @param {FileSystemRequest} req The request to clone an object.
     * @param {...any} args Constructor args to pass to the new object.
     * @returns {MUDObject} The newly cloned object.
     */
    cloneObjectSync(req, ...args) {
        if (!this.assert(FileSystem.FS_SYNC))
            return false;
        let { file, type, instance } = driver.efuns.parsePath(req.fullPath),
            module = driver.cache.get(file);

        if (instance > 0)
            throw new Error(`cloneObject() cannot request a specific instance ID`);

        let ecc = driver.getExecution();
        try {
            if (!module || !module.loaded) {
                module = driver.compiler.compileObject({ file: file });
            }
            if (module) {
                return module.createInstance(file, type, args);
            }
        }
        finally {
            delete ecc.newContext;
        }
        return false;
    }

    /**
     * Check to see if the expression contains wildcards.
     * @param {FileSystemRequest} req The request to check
     * @returns {boolean} True if the filename contains wildcards.
     */
    containsWildcards(req) {
        return req.fileName && req.fileName.match(/[\*\?]+/);
    }

    /**
     * Create a directory asyncronously.
     * @param {FileSystemRequest} req The directory to create.
     * @param {MkDirOptions} opts Options used to create directory (recursive, case, etc)
     * @param {function(boolean, Error):void=} callback Optional callback
     * @returns {string} The full path to the directory.
     */
    createDirectoryAsync(req, opts, callback) {
        return this.translatePath(req.relativePath, fullPath => {
            if (req.resolved)
                callback(false, new Error(`Directory already exists: ${req.fullPath}`));

            return fs.mkdir(fullPath, MXC.awaiter(err => {
                let ctx = driver.currentContext;
                if (ctx.aborted) return callback(false, new Error('Aborted'));
                callback(!err, err);
            }));
        });
    }

    /**
     * Create a directory syncronously.
     * @param {FileSystemRequest} req The directory expression to create.
     * @param {MkDirOptions} opts Additional options for createDirectory.
     * @returns {string} The full path to the newly created directory.
     */
    createDirectorySync(req) {
        return this.translatePath(req.relativePath, fullPath => {
            let parts = path.relative(this.root, fullPath).split(path.sep),
                ensure = (req.flags & MUDFS.MkdirFlags.EnsurePath) === MUDFS.MkdirFlags.EnsurePath;

            for (let i = 0, max = parts.length; i < max; i++) {
                let dir = this.root + path.sep + parts.slice(0, i).join(path.sep),
                    stat = this.statSync(dir);

                if (stat.exists) {
                    if (!ensure) return false;
                }
                else if ((i + 1) === max) {
                    fs.mkdirSync(dir);
                    return true;
                }
                else if (!ensure)
                    return false;
                else
                    fs.mkdirSync(dir);
            }
            return true;

        });
    }

    /**
     * Create a strongly-typed filesystem stat object.
     * @param {FileSystemStat} stat
     * @returns {FileSystemStat}
     */
    createStat(stat) {
        if (typeof stat.isDirectory === 'function')
            stat.isDirectory = stat.isDirectory();
        if (typeof stat.isFile === 'function')
            stat.isFile = stat.isFile();
        if (!stat.exists && (stat.atime > 0 || stat.isDirectory || stat.isFile))
            stat.exists = true;
        return new FileSystemStat(stat);
    }

    /**
     * Remove a directory from the filesystem.
     * @param {FileSystemRequest} req
     * @param {any} options
     * @param {function(boolean, Error):void} callback The callback that receives the result.
     */
    deleteDirectoryAsync(req, options, callback) {
        return this.translatePath(req.relativePath, absPath => {
            if (!req.resolved)
                return callback(false, new Error(`Directory does not exist: ${req.fullPath}`));

            return fs.rmdir(absPath, MXC.awaiter(err => {
                let ctx = driver.currentContext;
                if (ctx.aborted) return callback(false, new Error('Aborted'));
                callback(!err, err);
            }));
        });
    }

    /**
     * Translate an absolute path back into a virtual path.
     * @param {string} expr The absolute path to translate.
     * @returns {string|false} The virtual path if the expression exists in this filesystem or false if not.
     */
    getVirtualPath(expr) {
        if (expr.startsWith(this.root)) {
            let result = path.relative(this.root, expr);
            if (this.normalizer) {
                result = result.replace(this.normalizer, '/');
            }
            return result;
        }
        return false;
    }

    /**
     * Check to see if the expression is a directory.
     * @param {FileSystemRequest} req The filesystem request.
     * @param {function(boolean,Error):void} callback
     * @returns {void} Nothing for async
     */
    isDirectoryAsync(req, callback) {
        if (req.resolved) return callback(true, false);
        return this.translatePath(req.relativePath, fullPath => {
            return this.statAsync(fullPath, (stat, err) => {
                return callback(stat.isDirectory, err);
            });
        });
    }

    /**
     * Check to see if the expression is a directory.
     * @param {FileSystemRequest} req The filesystem request.
     * @returns {boolean} True or false depending on whether the expression is a directory.
     */
    isDirectorySync(req) {
        return this.translatePath(req, fullPath => {
            if (req.resolved && !req.fileName)
                return true;
            let stat = this.statSync(fullPath);
            return stat.isDirectory;
        });
    }

    /**
     * @param {FileSystemRequest} req The filesystem request.
     * @param {function(boolean,Error):void} callback
     * @returns {void} Nothing for async.
     */
    isFileAsync(req, callback) {
        return this.translatePath(req.relativePath, fullPath => {
            return this.statAsync(fullPath, (stat, err) => {
                return callback(stat.isFile, err);
            });
        });
    }

    /**
     * @param {FileSystemRequest} req The filesystem request.
     * @returns {boolean} True or false depending on if expression is a file.
     */
    isFileSync(req) {
        return this.translatePath(req.relativePath, fullPath => {
            let stat = this.statSync(fullPath);
            return stat.isFile;
        })
    }

    loadObjectAsync(req, args, callback) {
        throw new Error('Not implemented');
    }

    /**
     * Loads an object from storage.
     * @param {FileSystemRequest} req The path to load the object from.
     * @param {PathExpr} expr The path split into parts.
     * @param {any} args Optional constructor args.
     * @param {function(MUDObject):any} callback An optional callback
     * @returns {MUDObject} Returns the MUD object if successful.
     */
    loadObjectSync(req, expr, args, callback) {
        let module = driver.cache.get(expr.file),
            forceReload = !module || req.flags & 1 === 1;

        if (!forceReload) {
            let result = module.getInstance(expr);
            return callback ? callback(result) : result;
        }
        return this.translatePath(req.fullPath, absolutePath => {
            let files = this.readDirectorySync(req.clone(c => {
                c.fileName += '.*';
                c.flags = MUDFS.GetDirFlags.FullPath;
            }));

            if (files.length === 0)
                throw new Error(`File not found: ${expr.file}`);
            else if (files.length > 1)
                throw new Error(`File ambiguity: ${files.join(', ')}`);

            let absFile = this.translatePath(files[0]);
            let source = this.stripBOM(fs.readFileSync(absFile,
                { encoding: this.encoding || 'utf8' }));

            if (!source)
                throw new Error(`File (${files[0]}) appears to be empty!`);

            module = driver.compiler.compileObject({
                file: files[0],
                reload: forceReload,
                source: source,
                sourceFile: absFile,
                args: args
            });
            let result = module.getInstance(Object.assign({}, expr, { file: absFile }));
            return callback ? callback(result) : result;
        });
    }

    /**
     * Reads a directory listing from the disk.
     * @param {FileSystemRequest} req The directory part of the request.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectoryAsync(req, callback) {
        return this.translatePath(req.pathRel, fullPath => {
            let pattern = req.fileName ? new RegExp('^' + req.fileName.replace(/\./g, '\\.').replace(/\?/g, '.').replace(/\*/g, '.+') + '$') : false;
            if (req.flags & MUDFS.GetDirFlags.ImplicitDirs && !fullPath.endsWith('/')) fullPath += path.sep;

            fs.readdir(fullPath, { encoding: this.encoding }, MXC.awaiter((/** @type {Error} */ err, /** @type {string[]} */ files) => {
                if (req.flags === 0)
                    return callback(files, err);

                let results = [], ctx = driver.getContext();
                if (ctx.aborted) return callback(false, 'Aborted');
                let mxc = driver.getContext().clone(false, `readDirectory:${req.fullPath}`).restore();

                async.forEachOfLimit(files, this.asyncReaderLimit, (fn, i, itr) => {
                    if (ctx.aborted) return itr();
                    let fd = this.createStat({ exists: true, name: fn, parent: req.pathFull, path: req.pathFull + fn });

                    //  Does it match the pattern?
                    if (pattern && !pattern.test(fn)) return itr();

                    //  Is the file hidden?
                    if ((req.flags & MUDFS.GetDirFlags.Hidden) === 0 && fn.startsWith('.')) return itr();

                    // Do we need to stat?
                    if ((req.flags & MUDFS.GetDirFlags.Files) > 0 || (req.flags & MUDFS.GetDirFlags.Dirs) > 0) {
                        return fs.stat(fullPath + '/' + fn, (err, stat) => {
                            if (ctx.aborted) return itr(new Error('Aborted'));
                            if ((fd.isDirectory = stat.isDirectory()) && (req.flags & MUDFS.GetDirFlags.Dirs) === 0) return itr();
                            if ((fd.isFile = stat.isFile()) && (req.flags & MUDFS.GetDirFlags.Files) === 0) return itr();
                            results.push(fd.merge(stat));
                            return itr(err);
                        });
                    }
                    return itr();
                }, err => {
                    try {
                        ctx.aborted ? callback(false, 'Aborted') : callback(results, err);
                    }
                    finally {
                        mxc.release();
                    }
                });
            }, `readDirectoryAsync:${req}`));
        });
    }

    /**
     * Reads a directory listing from the disk.
     * @param {FileSystemRequest} req The path expression being read.
     */
    readDirectorySync(req) {
        return this.translatePath(req.pathRel, fullPath => {
            let pattern = req.fileName ? new RegExp('^' + req.fileName.replace(/\./g, '\\.').replace(/\?/g, '.').replace(/\*/g, '.+') + '$') : false;
            if (req.flags & MUDFS.GetDirFlags.ImplicitDirs && !fullPath.endsWith('/')) fullPath += path.sep;
            let files = fs.readdirSync(fullPath, { encoding: this.encoding }),
                result = [];

            if (req.flags === MUDFS.GetDirFlags.FullPath) {
                return (pattern ? files.filter(fn => pattern.test(fn)) : files)
                    .map(fn => req.pathFull + (req.pathFull.endsWith('/') ? '' : '/') + fn);
            }

            if (req.flags === 0)
                return pattern ? files.filter(fn => pattern.test(fn)) : files;

            files.forEach(fn => {
                let fd = this.createStat({ exists: true, name: fn, parent: req.fullPath });

                //  Does it match the pattern?
                if (pattern && !pattern.test(fn))
                    return false;

                //  Is the file hidden?
                if ((req.flags & MUDFS.GetDirFlags.Hidden) === 0 && fn.startsWith('.'))
                    return false;

                // Do we need to stat?
                if ((req.flags & MUDFS.GetDirFlags.Defaults) > 0) {
                    let stat = fs.statSync(fullPath + '/' + fn);

                    if ((fd.isDirectory = stat.isDirectory()) && (req.flags & MUDFS.GetDirFlags.Dirs) === 0)
                        return false;

                    if ((fd.isFile = stat.isFile()) && (req.flags & MUDFS.GetDirFlags.Files) === 0)
                        return false;

                    fd.merge(stat);
                }
                result.push(fd);
            });
            return result;
        });
    }

    /**
     * Read a file asyncronously from the filesystem.
     * @param {FileSystemRequest} req The request to read a file.
     * @param {function(string,Error):void} callback The callback to fire once the file is read.
     * @returns {void} Nothing for async.
     */
    readFileAsync(req, callback) {
        this.translatePath(req.relativePath, fullPath => {
            return fs.readFile(fullPath, { encoding: this.encoding }, MXC.awaiter((err, str) => {
                return callback(!err && this.stripBOM(str), err);
            }, `readFileAsync:${req}`));
        });
    }

    /**
     * Read a file syncronously from the filesystem.
     * @param {FileSystemRequest} req The file request.
     * @returns {string} The contents of the file.
     */
    readFileSync(req) {
        return this.translatePath(req.relativePath, fullPath => {
            return this.stripBOM(fs.readFileSync(fullPath, { encoding: this.encoding || 'utf8' }));
        });
    }

    /**
     * Read JSON/structured data from a file asyncronously.
     * @param {FileSystemRequest} req The path to read from.
     * @param {function(any,Error):void} callback The callback to fire when the data is loaded.
     * @returns {void} Nothing for async.
     */
    readJsonFileAsync(req, callback) {
        return this.readFileAsync(req, MXC.awaiter((content, err) => {
            try {
                return callback(!err && JSON.parse(content), err);
            }
            catch (e) {
                driver.cleanError(e);
                callback(false, e);
            }
        }, `readJsonFileAsync:${req}`));
    }

    /**
     * Read JSON/structured data from a file asyncronously.
     * @param {FileSystemRequest} req The path to read from.
     * @param {function(any,Error):void} callback The callback to fire when the data is loaded.
     * @returns {any} Structured data.
     */
    readJsonFileSync(req) {
        return this.translatePath(req.relativePath, filePath => {
            try {
                let content = this.readFile(req);
                return JSON.parse(content);
            }
            catch (err) {
            }
            return false;
        });
    }

    /**
     * Returns a filestat object.
     * @param {FileSystemRequest|string} req The path to stat.
     * @param {function(FileSystemStat,Error):void} callback The callback that receives the results.
     */
    statAsync(req, callback) {
        return this.translatePath(typeof req === 'string' ? req : req.relativePath, fullPath => {
            return fs.exists(fullPath, MXC.awaiter(doesExist => {
                if (doesExist) {
                    return fs.stat(fullPath, MXC.awaiter((err, stats) => {
                        return callback({
                            exists: true,
                            isDirectory: stats.isDirectory(),
                            isFile: stats.isFile(),
                            fileSize: stats.size,
                            parent: null
                        }, err);
                    }, `fs.stat:${req}`));
                }
                else {
                    return callback({
                        exists: false,
                        isDirectory: false,
                        isFile: false,
                        parent: null,
                        fileSize: req.endsWith('/') ? -2 : -1
                    }, new Error(`Path does not exist: ${req}`));
                }
            }, `statAsync:${req}`));
        });
    }

    /**
     * Stat a file syncronously.
     * @param {FileSystemRequest|string} req The path info to stat.
     * @returns {FileSystemStat} A filestat object (if possible)
     */
    statSync(req) {
        return this.translatePath(typeof req === 'string' ? req : req.relativePath, fullPath => {
            let result = false;
            if (fs.existsSync(fullPath)) {
                result = this.createStat(fs.statSync(fullPath));
            }
            else if (typeof req === 'string') {
                result = FileSystemStat.create({
                    exists: false,
                    isDirectory: false,
                    isFile: false,
                    parent: null,
                    size: req.endsWith('/') ? -2 : -1
                });
            }
            else {
                result = FileSystemStat.create({
                    exists: false,
                    isDirectory: false,
                    isFile: false,
                    size: req.fullPath.endsWith('/') ? -2 : -1
                });
            }
            Object.freeze(result);
            return result;
        });
    }

    /**
     * Returns a string without a Byte Order Marker (BOM)
     * @param {string|Buffer} content The content to check for BOM
     * @returns {string} The string minus any BOM.
     */
    stripBOM(content) {
        if (this.autoStripBOM) {
            if (typeof content === 'string' && content.charCodeAt(0) === 0xFEFF) {
                content = content.slice(1);
            }
        }
        return content;
    }

    /**
     * Translates a virtual path into an absolute path
     * @param {FileSystemRequest|string} req The virtual MUD path.
     * @param {function(string):void=} callback  An optional callback... this is depricated.
     * @returns {string} The absolute filesystem path.
     */
    translatePath(req, callback) {
        if (typeof req === 'string') {
            if (req.startsWith(this.root) && req.indexOf('..') === -1)
                return callback ? callback(req) : req;
            let result = path.join(this.root, req);
            if (!result.startsWith(this.root))
                throw new Error('Access violation');
            return callback ? callback(result) : result;
        }
        else return this.translatePath(req.relativePath, callback);
    }

    /**
     * Creates or overwites an existing file.
     * @param {FileSystemRequest} req The virtual MUD path.
     * @param {function(string):void=} callback  The callback thast receives success or failure notification.
     * @returns {void} Returns nothing for async.
     */
    writeFileAsync(req, content, callback) {
        return this.translatePath(req.relativePath, fullPath => {
            try {
                return fs.writeFile(fullPath, content, {
                    encoding: this.encoding || 'utf8',
                    flag: 'w'
                }, MXC.awaiter(err => callback(!err, err), `fs.writeFile:${req}`));
            }
            catch (err) {
                return callback(false, err);
            }
        });
    }

    /**
     * Creates or overwites an existing file.
     * @param {FileSystemRequest} req The virtual MUD path.
     * @returns {boolean} Returns true on success.
     */
    writeFileSync(req, content) {
        return this.translatePath(req.relativePath, fullPath => {
            try {
                fs.writeFileSync(fullPath, content, {
                    encoding: this.encoding || 'utf8',
                    flag: 'w'
                });
                return true;
            }
            catch (err) {
                return err;
            }
            return false;
        });
    }
}

module.exports = DefaultFileSystem;
