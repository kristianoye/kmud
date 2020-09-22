const
    BaseFileSystem = require('./BaseFileSystem'),
    mysql = require('mysql'),
    path = require('path'),
    fs = require('fs');

class MySqlFileSystem extends BaseFileSystem {
    /**
     * 
     * @param {FileManager} fm
     * @param {Object.<string,any>} options
     */
    constructor(fm, options) {
        super(fm, options);

        /** @type {number} */
        this.asyncReaderLimit = options.asyncReaderLimit > 0 ? options.asyncReaderLimit : 10;

        /** @type {string} */
        this.root = path.resolve(fm.mudlibRoot, options.path);

        /** @type {number} */
        this.flags = FileSystem.FS_ASYNC |
            FileSystem.FS_DIRECTORIES |
            FileSystem.FS_OBJECTS |
            FileSystem.FS_WILDCARDS;

        if (options.readOnly === true)
            this.flags |= FileSystem.FS_READONLY;

        /** @type {boolean} */
        this.autoStripBOM = typeof options.autoStripBOM === 'boolean' ?
            options.autoStripBOM : true;
    }
}

module.exports = MySqlFileSystem;
