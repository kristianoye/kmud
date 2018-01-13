﻿const
    FileSystem = require('../FileSystem').FileSystem,
    FileManager = require('../FileManager'),
    path = require('path'),
    fs = require('fs');

class DefaultFileSystem extends FileSystem {
    /**
     * 
     * @param {FileManager} fm
     * @param {Object.<string,any>} options
     */
    constructor(fm, options) {
        super(fm, options);

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
                break;''
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
     */
    appendFileAsync(req, content, callback) {
        return this.translatePath(req.relativePath, fullPath => {
            return fs.writeFile(filepath, content, {
                encoding: this.encoding || 'utf8',
                flag: 'a'
            }, (err) => callback(!err, err));
        });
    }

    /**
     * Appends content to a file syncronously.
     * @param {FileSystemRequest} req
     * @param {string|Buffer} content The content to write to file.
     */
    appendFileSync(req, content) {
        return this.translatePath(req.relativePath, fullPath => {
            return fs.writeFileSync(filepath, content, {
                encoding: this.encoding || 'utf8',
                flag: 'a'
            });
        });
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
     * @param {MkDirOptions} opts
     * @param {function(boolean, Error):void} callback
     */
    createDirectoryAsync(req, opts, callback) {
        return this.translatePath(req.relativePath, fullPath => {
            if (req.resolved) return callback(false, new Error(`Directory already exists: ${req.fullPath}`));
            return fs.mkdir(fullPath, err => callback(!err, err));
        });
    }

    /**
     * Create a directory syncronously.
     * @param {FileSystemRequest} req The directory expression to create.
     * @param {MkDirOptions} opts Additional options for createDirectory.
     */
    createDirectorySync(req) {
        return this.translatePath(req.relativePath, fullPath => {
            let parts = path.relative(this.root, fullPath).split(path.sep),
                ensure = (req.flags & MkdirFlags.EnsurePath) === MkdirFlags.EnsurePath;

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
    }

    /**
     * Loads an object from storage.
     * @param {FileSystemRequest} req The path to load the object from.
     * @param {any} args Optional constructor args.
     * @returns {MUDObject}
     */
    loadObjectSync(req, args) {
        let [virtualPath, instanceStr] = req.fullPath.split('#', 2),
            instanceId = instanceStr ? parseInt(instanceStr) : 0;

        if (isNaN(instanceId))
            throw new Error(`Invalid instance identifier: ${instanceStr}`);

        return this.translatePath(virtualPath, absolutePath => {
            let module = driver.cache.get(virtualPath),
                icmax = module && module.instances.length;

            if (module && module.loaded && (!instanceId || instanceId < icmax)) {
                if (module.instances[instanceId])
                    return module.getWrapper(instanceId);
                else if (instanceId === 0)
                    return module.createInstance(0, false, args);
                else
                    return false;
            }
            else if (instanceId === 0) {
                module = driver.compiler.compileObject(virtualPath, false, undefined, args);
                return module ? module.getWrapper(0) : false;
            }
            else
                return false;
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
            if (req.flags & GetDirFlags.ImplicitDirs && !fullPath.endsWith('/')) fullPath += path.sep;
            fs.readdir(fullPath, { encoding: this.encoding }, (err, files) => {
                if (pattern) files = files.filter(s => pattern.test(s)); 
                return callback(!err && files, err);
            });
        });
    }

    /**
     * Reads a directory listing from the disk.
     * @param {FileSystemRequest} req The path expression being read.
     */
    readDirectorySync(req) {
        return this.translatePath(req.pathRel, fullPath => {
            let pattern = req.fileName ? new RegExp('^' + req.fileName.replace(/\./g, '\\.').replace(/\?/g, '.').replace(/\*/g, '.+') + '$') : false;
            if (req.flags & GetDirFlags.ImplicitDirs && !fullPath.endsWith('/')) fullPath += path.sep;
            let files = fs.readdirSync(fullPath, { encoding: this.encoding });
            if (pattern) files = files.filter(s => pattern.test(s));
            return files;
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
            return fs.readFile(fullPath, { encoding: this.encoding }, (err, str) => {
                return callback(!err && this.stripBOM(str), err);
            });
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
        return this.readFileAsync(req, (content, err) => {
            try {
                return callback(!err && JSON.parse(content), err);
            }
            catch (e) {
                driver.cleanError(e);
                callback(false, e);
            }
        });
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
            return fs.exists(fullPath, doesExist => {
                if (doesExist) {
                    return fs.stat(fullPath, (err, stats) => {
                        return callback({
                            exists: true,
                            isDirectory: stats.isDirectory(),
                            isFile: stats.isFile(),
                            fileSize: stats.size,
                            parent: null
                        }, err);
                    });
                }
                else {
                    return callback({
                        exists: false,
                        isDirectory: req.endsWith('/'),
                        isFile: !req.endsWith('/'),
                        parent: null,
                        fileSize: req.endsWith('/') ? -2 : -1
                    }, new Error(`Path does not exist: ${req}`));
                }
            });
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
                let info = fs.statSync(fullPath);
                result = {
                    exists: true,
                    isDirectory: info.isDirectory(),
                    isFile: info.isFile(),
                    fileSize: info.size,
                    atime: info.atimeMs,
                    mtime: info.mtimeMs,
                    parent: null
                };
            }
            else {
                result = {
                    exists: false,
                    isDirectory: false,
                    isFile: false,
                    fileSize: 0,
                    parent: null
                };
            }
            Object.freeze(result);
            return result;
        });
    }

    /**
     * Returns a string without a Byte Order Marker (BOM)
     * @param {string|Buffer} content
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
     * @param {function(string):void=} callback 
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
                return fs.writeFile(filepath, content, {
                    encoding: this.encoding || 'utf8',
                    flag: 'w'
                }, err => callback(!err, err));
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
                return fs.writeFileSync(filepath, content, {
                    encoding: this.encoding || 'utf8',
                    flag: 'w'
                });
                return true;
            }
            catch (err) {

            }
            return false;
        });
    }
}

module.exports = DefaultFileSystem;