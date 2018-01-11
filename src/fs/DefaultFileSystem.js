const
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
     * @param {string} expr The file expression to convert.
     */
    getRealPath(expr) {
        return path.resolve(this.root, expr);
    }

    /**
     * Appends content to a file asyncronously.
     * @param {string} expr
     * @param {any} content
     * @param {function} callback
     */
    appendFileAsync(expr, content, callback) {
        let filepath = this.translatePath(expr);
        return fs.writeFile(filepath, content, {
            encoding: this.encoding || 'utf8',
            flag: 'a'
        }, callback);
    }

    /**
     * Appends content to a file syncronously.
     * @param {string} expr
     * @param {any} content
     */
    appendFileSync(expr, content) {
        let filepath = this.translatePath(expr);
        return fs.writeFileSync(filepath, content, {
            encoding: this.encoding || 'utf8',
            flag: 'a'
        });
    }

    /**
     * Check to see if the expression contains wildcards.
     * @param {string} expr
     * @returns {boolean}
     */
    containsWildcards(expr) {
        return expr.match(/[\*\?]+/);
    }

    /**
     * Create a directory asyncronously.
     * @param {string} expr
     * @param {MkDirOptions} opts
     * @param {function(boolean, Error):void} callback
     */
    createDirectoryAsync(expr, opts, callback) {
        let filepath = this.translatePath(expr);
        return fs.mkdir(filepath, callback);
    }

    /**
     * Create a directory syncronously.
     * @param {string} expr The directory expression to create.
     * @param {MkDirOptions} opts Additional options for createDirectory.
     */
    createDirectorySync(expr, opts) {
        return this.translatePath(expr, filePath => {
            let parts = path.relative(this.root, filePath).split(path.sep),
                ensure = (opts.flags & MkdirFlags.EnsurePath) === MkdirFlags.EnsurePath;

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

    isDirectoryAsync(expr, callback) {
        return this.translatePath(expr, fullPath => {
            return this.statAsync(fullPath, (stat, err) => {
                return callback(stat.isDirectory, err);
            });
        });
    }

    isDirectorySync(expr) {
        return this.translatePath(expr, fullPath => {
            let stat = this.statSync(fullPath);
            return stat.isDirectory;
        })
    }

    isFileAsync(expr, callback) {
        return this.translatePath(expr, fullPath => {
            return this.statAsync(fullPath, (stat, err) => {
                return callback(stat.isFile, err);
            });
        });
    }

    isFileSync(expr) {
        return this.translatePath(expr, fullPath => {
            let stat = this.statSync(fullPath);
            return stat.isFile;
        })
    }

    loadObjectAsync(expr, args, callback) {
    }

    /**
     * Loads an object from storage.
     * @param {string} expr The path to load the object from.
     * @param {any} args Optional constructor args.
     * @returns {MUDObject}
     */
    loadObjectSync(expr, args) {
        let module = this.driver.cache.get(expr);
        if (module && module.loaded) {

        }
    }

    /**
     * Reads a directory listing from the disk.
     * @param {string} expr The directory part of the request.
     * @param {numeric} flags Numeric flags indicating requests for additional detail.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectoryAsync(expr, flags, callback) {
        let muddir = expr.endsWith('/') ? expr : expr.slice(0, expr.lastIndexOf('/')),
            filePart = expr.slice(muddir.length);

        return this.translatePath(muddir, fullPath => {
            let pattern = filePart.length ? new RegExp('^' + filePart.replace(/\./g, '\\.').replace(/\?/g, '.').replace(/\*/g, '.+') + '$') : false;
            fs.readdir(fullPath, { encoding: this.encoding }, (err, files) => {
                if (pattern) {
                    files = files.filter(s => pattern.test(s));
                }
                return callback(!err && files, err);
            });
        });
    }

    /**
     * Reads a directory listing from the disk.
     * @param {string} muddir The directory part of the request.
     * @param {string} expr The path expression being read.
     * @param {numeric} flags Numeric flags indicating requests for additional detail.
     * @param {function(string[], Error):void} callback Optional callback for async mode.
     */
    readDirectorySync(muddir, expr, flags) {
        let muddir = expr.endsWith('/') ? expr : expr.slice(0, expr.lastIndexOf('/')),
            filePart = expr.slice(muddir.length);

        return this.translatePath(muddir, fullPath => {
            let pattern = expr.length ? new RegExp('^' + expr.replace(/\./g, '\\.').replace(/\?/g, '.').replace(/\*/g, '.+') + '$') : false;
            let files = fs.readdirSync(fullPath, { encoding: this.encoding });
            if (pattern) {
                files = files.filter(s => pattern.test(s));
            }
            return files;
        });
    }

    /**
     * Read a file syncronously from the filesystem.
     * @param {any} expr
     */
    readFileSync(expr) {
        let filepath = this.translatePath(expr);
        return this.stripBOM(fs.readFileSync(filepath, {
            encoding: this.encoding
        }));
    }

    /**
     * Read a file asyncronously from the filesystem.
     * @param {string} expr
     * @param {function(string,Error):void} callback
     */
    readFileAsync(expr, callback) {
        let filepath = this.translatePath(expr);
        return fs.readFile(filepath, { encoding: this.encoding }, (err, s) => {
            return err ?
                callback(false, err) :
                callback(this.stripBOM(s), false);
        });
    }

    /**
     * Read JSON/structured data from a file asyncronously.
     * @param {string} expr The path to read from.
     * @param {function(any,Error):void} callback The callback to fire when the data is loaded.
     */
    readJsonFileAsync(expr, callback) {
        return this.readFileAsync(expr, (content, err) => {
            try {
                let data = content && JSON.parse(content);
                return callback(data, err);
            }
            catch (e) {
                callback(false, e);
            }
        });
    }

    readJsonFileSync(expr) {
        return this.translatePath(expr, filePath => {
            try {
                let content = this.readFile(expr);
                return JSON.parse(content);
            }
            catch (err) {
            }
            return false;
        });
    }

    /**
     * Stat a file syncronously.
     * @param {string} expr
     * @param {number} flags
     * @returns {FileStat} A filestat object (if possible)
     */
    statSync(expr, flags) {
        return this.translatePath(expr, fullPath => {
            let result = false;
            if (fs.existsSync(fullPath)) {
                let info = fs.statSync(fullPath);
                result = {
                    exists: true,
                    isDirectory: info.isDirectory(),
                    isFile: info.isFile(),
                    fileSize: info.size,
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
     * @param {string} expr The virtual MUD path.
     * @param {function(string):void=} callback 
     * @returns {string} The absolute filesystem path.
     */
    translatePath(expr, callback) {
        if (expr.startsWith(this.root) && expr.indexOf('..') === -1)
            return callback ? callback(expr) : expr;
        let result = path.join(this.root, expr);
        if (!result.startsWith(this.root))
            throw new Error('Access violation');
        return callback ? callback(result) : result;
    }

    writeFileAsync(expr, content, callback) {
        let filepath = this.translatePath(expr);
        return fs.writeFile(filepath, content, {
            encoding: this.encoding || 'utf8',
            flag: 'w'
        }, callback);
    }

    writeFileSync(expr, content) {
        let filepath = this.translatePath(expr);
        return fs.writeFileSync(filepath, content, {
            encoding: this.encoding || 'utf8',
            flag: 'w'
        });
    }
}

module.exports = DefaultFileSystem;
