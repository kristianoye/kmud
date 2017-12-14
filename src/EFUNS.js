/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const
    async = require('async'),
    fs = require('fs'),
    path = require('path'),
    FS_GETDETAIL = 1 << 0,
    FS_GETPERMS = 1 << 1,
    FS_GETSTATUS = 1 << 2,
    FT_DIRECTORY = 1,
    FT_FILE = 2,
    basePath = path.resolve('src'),
    libPath = path.resolve('lib'),
    MUDExecutionContext = require('./MUDExcecutionContext');

const
    PLURAL_SUFFIX = 1,
    PLURAL_SAME = 2,
    PLURAL_CHOP = 2;

/**
    * @callback isFileTypeCallback
    * @param {boolean} isType Flag indicating whether the asserted type is the actual type of the file
    * @param {string} error An error message or false if none.
    * @param {string} filename The name of the file checked.
    * @param {number} type The type of object checked for.
    */

class EFUNS {
    assertValidPath(path) {
        if (!path.startsWith(libPath))
            throw new Error('Illegal access attempt');
    }

    mkdir(dirname, callback) {
        var _async = typeof callback === 'function';
        this.assertValidPath(dirname);
        var parts = dirname.split(path.sep);

        if (!dirname.endsWith(path.sep)) parts.pop();

        if (_async) {
            var ctx = new MUDExecutionContext();
            async.eachOfSeries(parts, (item, i, cb) => {
                var dir = parts.slice(0, i + 1).join(path.sep);
                this.isDirectory(dir, exists => {
                    if (exists) cb();
                    else {
                        fs.mkdir(dir, err => {
                            ctx.run(() => {
                                err ? cb(err) : cb();
                            });
                        });
                    }
                });
            }, function (err) {
                ctx.run(() => {
                    err ? callback(err, parts.join(path.sep)) : callback(false, parts.join(path.sep));
                });
            });
            return this;
        }
        for (var i = 0, max = parts.length; i < max; i++) {
            var dir = parts.slice(0, i+1).join(path.sep);
            if (dir.length > 0 && !this.isDirectory(dir)) {
                fs.mkdirSync(dir);
            }
        }
        return true;
    }

    /**
     * Returns additional details about a collection of files.
     *
     * @param {string} dirname The directory in which the files live.
     * @param {string} filename The file to get details for.
     * @param {number} flags Optional flags that specify what details are needed.
     * @param {function} callback Optional callback if this is an async call.
     * @returns {string[]|null} Returns file information in sync mode or nothing if async.
     */
    getDetail(dirname, filename, flags, callback) {
        var _async = typeof callback === 'function',
            _filename = dirname + path.sep + filename;

        var result = [filename];

        /**
         * Add file details to file result.
         * @param {Array} result The result to add to.
         * @param {fs.Stats} stat Info about the filesystem object.
         */
        function addStat(result, statIn) {
            var stat = statIn || fs.statSync(_filename),
                size = stat.size;

            if (stat.isDirectory()) size = -2;
            else if (stat.isSocket()) size = -3;
            else if (stat.isSymbolicLink()) size = -4;
            else if (stat.isFIFO()) size = -5;
            else if (stat.isBlockDevice()) size = -6;
            else if (stat.isCharacterDevice()) size = -7;

            result.push(size);
            result.push(stat.mtimeMs || (stat.mtime ? stat.mtime.getTime() : 0));
            result.push(stat.ctimeMs || (stat.birthtime ? stat.birthtime.getTime() : 0));
        }

        if (_async) {
            if ((flags & FS_GETDETAIL) > 0) {
                fs.stat(_filename, function (err, stat) {
                    if (err) result.push(-8, 0, 0);
                    else addStat(result, stat);
                    callback(result);
                });
            }
        }
        else {
            if ((flags & FS_GETDETAIL) > 0) {
                addStat(result, fs.statSync(_filename));
            }
            return result;
        }
    }

    /**
     * Returns file information based on the specified file expression.
     * @param {string} filepath The file expression to evaluate.
     * @param {number} flags Flags indicating what additional information is being requested.
     * @param {function} callback An optional async callback.
     * @returns {ArrayLike<string|ArrayLike<any>>|undefined} Return type varies by async/sync operation.
     */
    getDir(filepath, flags, callback) {
        var _async = typeof callback === 'function',
            _parts = filepath.split(path.sep),
            _file = _parts[_parts.length - 1],
            _restOfPath = _parts.length > 1 ? _parts.slice(0, _parts.length - 1).join(path.sep) : path.sep,
            _pattern = new RegExp('^' + _file.replace('.', '\\.').replace('?', '.').replace('*', '.+') + '$');

        if (!filepath.startsWith(libPath))
            throw new Error('Security Violation');

        if (_async) {
            return this.isDirectory(filepath, (isDir) => {
                return fs.readdir(isDir ? filepath : _restOfPath, (err, files) => {
                    if (err)
                        return callback(false, 'An error occurred');
                    if (!isDir)
                        files = files.filter(function (_fn) { return _pattern.test(_fn); });
                    if (flags) {
                        var c = 0;
                        files.forEach((_fn, i, a) => {
                            this.getDetail(isDir ? filepath : _restOfPath, _fn, flags, function (data) {
                                files[i] = data;
                                c++;
                                if (c === a.length) callback(files, false);
                            });
                        });
                    }
                    else callback(files, false);
                });
            });
        }
        else {
            var isDir = this.isDirectory(filepath),
                files = fs.readdirSync(isDir ? filepath : _restOfPath);

            if (flags)
                return files.map((_fn) => {
                    return this.getDetail(isDir ? filepath : _restOfPath, _fn, flags);
                });
            else
                return files;
        }
    }

    /**
     * Determine whether the file is expression is a particular file object type.
     * @param {string} path The file expression to evaluate.
     * @param {number} type The type of file to check for.
     * @param {function=} callback An optional callback for async operation.
     */
    isFileType(path, type, callback) {
        var _async = typeof callback === 'function';

        if (_async) {
            fs.exists(path, function (exists) {
                if (exists) {
                    fs.stat(path, function (err, stat) {
                        if (err) {
                            callback(false, err, path);
                        }
                        else {
                            switch (type) {
                                case 1: return callback(stat.isDirectory(), false, path, type);
                                case 2: return callback(stat.isFile(), false, path, type);
                                default: return callback(false, 'Unknown object type', path, type);
                            }

                        }
                    });
                }
                else callback(false, path + ' does not exist', path);
            });
        }
        else {
            if (fs.existsSync(path)) {
                var stat = fs.statSync(path);
                switch (type) {
                    case 1: return stat.isDirectory();
                    case 2: return stat.isFile();
                    default: return false;
                }
            }
            return false;
        }
    }

    /**
     * Determines whether the specified file expression is a directory.
     * @param {string} path The path to check.
     * @param {function} callback The callback to execute when the result is known.
     * @returns {boolean} True if the path exists and is a directory.
     */
    isDirectory(path, callback) {
        return this.isFileType(path, FT_DIRECTORY, callback);
    }

    /**
     * Determines whether the specified file expression is a regular file.
     * @param {string} path The path to check.
     * @param {function} callback The callback to execute when the result is known.
     * @returns {boolean} True if the path exists and is a regular file.
     */
    isFile(path, callback) {
        return this.isFileType(path, FT_FILE, callback);
    }

    /**
     * Converts a MUD file path into an absolute file path.
     * @param {string} mudpath The MUD path to translate.
     * @returns {string} The absolute path.
     */
    mudPathToAbsolute(mudpath) {
        return path.resolve(libPath, mudpath.startsWith('/') ? mudpath.substr(1) : mudpath);
    }

    /**
     * Converts an absolute path into a MUD path.
     * @param {string} abspath The absolute file path to translate.
     * @returns {string|false} The converted path or false if the conversion was not possible.
     */
    pathToMudPath(abspath) {
        if (typeof abspath !== 'string') return false;
        var relp = abspath.slice(libPath.length).replace(/\\/g, '/');
        return relp;
    }
    
    /**
     * Based on MudOS pluralize() + a few bug fixes.  Converts a string to the pluralized version.
     * Examples: child -> children, fox -> foxes.
     *
     * @param {string} what The string to pluralize.
     * @returns {string} A pluralized form of the string.
     */
    pluralize(what) {
        var o = unwrap(what),
            result;

        if (o) {
            var _p = _o.getPluralizedName();
            if (_p) return _p;
            return this.pluralize(o.getPrimaryName());
        }
        if (typeof what !== 'string')
            throw new Error(`Bad argument 1 to pluralize(); Expected string|object got ${typeof what}`);

        var m = / of /i.exec(what);
        if (m && m.index > 0) {
            return this.pluralize(what.slice(0, m.index)) + what.slice(m.index);
        }
        if (what.match(/a /i))
            return this.pluralize(what.slice(2));
        else if (what.match(/an /i))
            return this.pluralize(what.slice(3));

        if (what.indexOf(' ') > -1) {
            var lastIndex = what.lastIndexOf(' ');
            return what.slice(0, lastIndex + 1) + this.pluralize(what.slice(lastIndex + 1));
        }

        var found = 0,
            suffix = 's',
            toUpper = what.toUpperCase() === what,
            whatLC = what.toLowerCase(),
            result;

        switch (what.charAt(0).toLowerCase()) {
            case 'a':
                if (whatLC === 'are') {
                    found = PLURAL_CHOP + 3;
                    suffix = "is";
                }
                break;

            case 'b':
                if (whatLC === 'bus') {
                    found = PLURAL_SUFFIX;
                    suffix = "es";
                }
                else if (what.match(/^bonus/i)) {
                    found = PLURAL_SUFFIX;
                    suffix = "es";
                }
                break;

            case 'c':
                if (whatLC === 'child') {
                    found = PLURAL_SUFFIX;
                    suffix = "ren";
                }
                else if (what.match(/^cliff/i)) {
                    found = PLURAL_SUFFIX;
                    suffix = "s";
                }
                break;

            case 'd':
                if (whatLC === 'datum') {
                    found = PLURAL_CHOP + 2;
                    suffix = 'a';
                }
                else if (whatLC === 'die') {
                    found = PLURAL_CHOP + 1;
                    suffix = 'ce';
                }
                else if (whatLC === 'deer') {
                    found = PLURAL_SAME;
                }
                else if (whatLC === 'do') {
                    found = PLURAL_SUFFIX;
                    suffix = 'es';
                }
                else if (whatLC === 'dynamo') {
                    found = PLURAL_SUFFIX;
                }
                break;

            case 'f':
                if (whatLC === 'foot') {
                    found = PLURAL_CHOP + 3;
                    suffix = 'feet';
                }
                else if (whatLC === 'fish') {
                    found = PLURAL_SAME;
                }
                else if (whatLC === 'forum') {
                    found = PLURAL_CHOP + 2;
                    suffix = 'a';
                }
                else if (whatLC === 'fife') {
                    found = PLURAL_SUFFIX;
                }

            case 'g':
                switch (whatLC) {
                    case 'gum':
                    case 'giraffe':
                        found = PLURAL_SUFFIX;
                        break;
                    case 'glasses':
                        found = PLURAL_SAME;
                        break;
                    case 'goose':
                        found = PLURAL_CHOP + 4;
                        suffix = 'eese';
                        break;
                    case 'go':
                        found = PLURAL_SUFFIX;
                        suffix = 'es';
                        break;
                }
                break;

            case 'h':
                if (whatLC === 'human')
                    found = PLURAL_SUFFIX;
                else if (whatLC === 'have')
                    found = PLURAL_CHOP + 2;
                break;

            case 'i':
                if (whatLC === 'index') {
                    found = PLURAL_CHOP + 2;
                    suffix = 'ices';
                }
                break;

            case 'l':
                if (whatLC === 'louse') {
                    found = PLURAL_CHOP + 4;
                    suffix = 'ice';
                }
                else if (whatLC === 'lotus')
                    found = PLURAL_SUFFIX;
                break;

            case 'm':
                switch (whatLC) {
                    case 'mackerel':
                    case 'moose':
                        found = PLURAL_SAME;
                        break;
                    case 'mouse':
                        found = PLURAL_CHOP + 4;
                        suffix = 'ice';
                        break;
                    case 'matrix':
                        found = PLURAL_CHOP + 1;
                        suffix = 'ces';
                        break;
                    case 'mech':
                        found = PLURAL_SUFFIX;
                        break;
                }
                break;

            case 'o':
                if (whatLC === 'ox') {
                    found = PLURAL_SUFFIX;
                    suffix = 'en';
                }

            case 'p':
                if (whatLC === 'pants')
                    found = PLURAL_SAME;
                break;

            case 'q':
                if (whatLC === 'quaff')
                    found = PLURAL_SUFFIX;
                break;

            case 'r':
                switch (whatLC) {
                    case 'remains':
                        found = PLURAL_SAME;
                        break;
                    case 'roof':
                        found = PLURAL_SUFFIX;
                        break;
                }
                break;

            case 's':
                switch (whatLC) {
                    case 'sniff':
                    case 'safe':
                    case 'shaman':
                        found = PLURAL_SUFFIX;
                        break;
                    case 'sheep':
                        found = PLURAL_SAME;
                        break;
                    case 'sphinx':
                        found = PLURAL_CHOP + 1;
                        suffix = 'ges';
                        break;
                    case 'staff':
                        found = PLURAL_CHOP + 2;
                        suffix = 'ves';
                }
                break;

            case 't':
                switch (whatLC) {
                    case 'thief':
                        found = PLURAL_CHOP + 1;
                        suffix = 'ves';
                        break;
                    case 'tooth':
                        found = PLURAL_CHOP + 4;
                        suffix = 'eeth';
                        break;
                    case 'talisman':
                        found = PLURAL_SUFFIX;
                        break;
                }
                break;

            case 'v':
                switch (whatLC) {
                    case 'vax':
                        found = PLURAL_SUFFIX;
                        suffix = 'en';
                        break;
                    case 'virus':
                        found = PLURAL_SUFFIX;
                        suffix = 'es';
                        break;
                }
                break;

            case 'w':
                switch (whatLC) {
                    case 'was':
                        found = PLURAL_CHOP + 2;
                        suffix = 'ere';
                        break;
                }
                break;
        }

        if (!found) {
            function getEnd(n) {
                var a = [].slice.call(arguments, 1),
                    r = whatLC.slice(whatLC.length - n);
                if (a.length) return a.filter(_ => _ === r).length > 0;
                return r;
            }
            switch (getEnd(1)) {
                case 'e':
                    if (whatLC.endsWith('fe')) {
                        found = PLURAL_CHOP + 2;
                        suffix = 'ves';
                    }
                    break;
                case 'f':
                    if (whatLC.endsWith('ef'))
                        break;
                    else {
                        found = PLURAL_CHOP + 1;
                        if (whatLC.endsWith('ff')) suffix = 'ves'
                    }
                    break;
                case 'h':
                    if (whatLC.endsWith('sh') || whatLC.endsWith('ch'))
                        suffix = 'es';
                    break;
                case 'm':
                    if (whatLC.endsWith('mu')) {
                        found = PLURAL_CHOP + 2;
                        suffix = 'a';
                    }
                    break;
                case 'n':
                    if (whatLC.endsWith('man')) {
                        found = PLURAL_CHOP + 3;
                        suffix = 'man';
                    }
                    break;
                case 'o':
                    if (whatLC.endsWith('oo')) {
                        found = PLURAL_CHOP + 2;
                        suffix = 'es';
                    }
                    break;
                case 's':
                    if (whatLC.endsWith('is')) {
                        found = PLURAL_CHOP + 2;
                        suffix = 'es';
                    }
                    else if (whatLC.endsWith('us')) {
                        found = PLURAL_CHOP + 2;
                        suffix = 'i';
                    }
                    else if (whatLC.endsWith('as') || whatLC.endsWith('es') || whatLC.endsWith('os'))
                        suffix = 'ses';
                    else
                        suffix = 'es';
                    break;
                case 'x':
                    suffix = 'es';
                    break;
                case 'y':
                    if (!whatLC.match(/[aeiou]y$/i)) {
                        found = PLURAL_CHOP + 1;
                        suffix = 'ies';
                    }
                    break;
                case 'z':
                    if (whatLC.match(/[aeiou]z$/i)) 
                        suffix = 'zes';
                    else 
                        suffix = 'es';
                    break;
            }
        }
        switch (found) {
            case PLURAL_SAME:
                result = what;
                break;

            default:
                what = what.slice(0, what.length - found - PLURAL_CHOP + 1);

            case 0:
            case PLURAL_SUFFIX:
                result = what + suffix;
        }
        return toUpper ? result.toUpperCase() : result;
    }


    /**
     * Read a plain file and return the contents as a string.
     * @param {string} filename The name of the file to read.
     * @param {function} callback An async callback that will receive the file content.
     * @returns {string} The contents of the file if executed in sync mode.
     */
    readFile(filename, callback) {
        var _async = typeof callback === 'function';
        if (_async) {
            this.isFile(filename, (exists) => {
                if (exists) {
                    fs.readFile(filename, (err, buffer) => {
                        var str = this.stripBOM(buffer.toString('utf8'));
                        callback(str, false);
                    });
                }
                else callback(false, filename + ' is not a regular file');
            });
        }
        else {
            if (this.isFile(filename))
                return this.stripBOM(fs.readFileSync(filename).toString('utf8'));
            else
                throw new Error(filename + ' is not a regular file');
        }
    }

    /**
     * Removes a file.
     * @param {string} path The file to remove.
     * @param {function} callback The optional callback to execute when the async remove is done.
     */
    rm(path, callback) {
        var _async = typeof callback === 'function';
        this.assertValidPath(path);

        if (_async) {
            this.isFile(path, (exists, error) => {
                if (exists) {
                    fs.unlink(path);
                    this.isFile(path, e => {
                        return callback(e ? new Error('Failed to remove file') : false, path);
                    });
                }
                return callback(error || new Error('Failed to remove file'), path);
            });
        }
        fs.unlinkSync(path);
        return fs.existsSync(path) ? false : true;
    }

    rmdir(path, callback) {
        this.assertValidPath(path);
        var _async = typeof callback === 'function';

        if (_async) {
            this.isDirectory(path, exists => {
                if (exists) {
                    fs.rmdir(path, err => {
                        callback(!err, err);
                    });
                }
                else {
                    callback(false, 'Specified path does not exist.');
                }
            });
            return this;
        }
        try
        {
            fs.rmdirSync(path);
        }
        catch (x) {
        }
        return !this.isDirectory(path);
    }

    /**
     * Removes the UTF8 BOM from a string if it exists.
     * @param {string} content The string to check.
     * @returns {string} The stripped string.
     */
    stripBOM(content) {
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }
        return content;
    }

    /**
     * Write the specified string to a file.
     * @param {string} filename The name of the file to write to.
     * @param {string} content The content to write to file.
     * @param {function} callback Callback for async operation which will receive a flag indicating success or failure.
     */
    writeFile(filename, content, callback) {
        var _async = typeof callback === 'function';
        if (_async)
            fs.writeFile(filename, content, err => {
                callback(!err, err);
            });
        else
            return fs.writeFileSync(filename, content);
    }
}

module.exports = EFUNS;
