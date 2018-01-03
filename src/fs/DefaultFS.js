const
    FileSystem = require('../FileSystem'),
    path = require('path'),
    fs = require('fs');

class DefaultFS extends FileSystem {
    constructor(config) {
        super();
        /** @type {string} */
        this.root = config.root;

        /** @type {number} */
        this.modes = FileSystem.FS_ASYNC | FileSystem.FS_ASYNC | FileSystem.FS_DIRECTORIES;

        /** @type {RegExp} */
        this.translator = new RegExp(/\//g);
    }

    /**
     * Translates a virtual path into an absolute path
     * @param {string} expr The virtual MUD path.
     * @returns {string} The absolute filesystem path.
     */
    translatePath(expr) {
        let result = path.join(this.root, expr.slice(1).replace(this.translator, path.sep));
        if (!result.startsWith(this.root))
            throw new Error('Access violation');
        return result;
    }

    /**
     * Appends content to a file asyncronously.
     * @param {string} expr
     * @param {any} content
     * @param {function} callback
     */
    appendFileAsync(expr, content, callback) {
        let filepath = this.translatePath(expr);
        return fs.writeFile(filepath, content, callback);
    }

    /**
     * Appends content to a file syncronously.
     * @param {string} expr
     * @param {any} content
     */
    appendFileSync(expr, content) {
        let filepath = this.translatePath(expr);
        return fs.writeFileSync(filepath, content);
    }

    createDirectoryAsync(expr, callback) {
        let filepath = this.translatePath(expr);
        return fs.mkdir(filepath, callback);
    }

    createDirectorySync(expr) {
        let filepath = this.translatePath(expr);
        return fs.mkdirSync(filepath);
    }
}

module.exports = DefaultFS;
