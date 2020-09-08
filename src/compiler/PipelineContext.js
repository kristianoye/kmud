const
    CTX_INIT = -1,
    CTX_RUNNING = 1,
    CTX_STOPPED = 2,
    CTX_ERRORED = 3,
    CTX_FINISHED = 4,
    fs = require('fs');

const
    GameServer = require('../GameServer');

class PipelineContext {
    /**
     * 
     * @param {string} filename The name of the file to be compiled.
     * @param {boolean=} isEval Indicates the code is from eval()
     */
    constructor(filename, isEval) {
        var n = filename && filename.lastIndexOf('.') || -1;

        filename = filename.replace(/\\/g, '/');

        this.extension = n > -1 ? filename.slice(n) : false
        this.basename = n > -1 ? filename.slice(0, n) : filename;
        this.filename = filename;
        if ((this.isEval = isEval || false) === false)
            this.realName = driver.fileManager.toRealPath(this.filename);
        this.resolvedName = false;
        this.content = '';
        this.errors = [];
        this.exists = false;
        this.state = CTX_INIT;
    }

    addError(err) {
        this.state = CTX_ERRORED;
        this.errors.push(err);
        return this;
    }

    /**
     * Add an arbitrary value to the context collection.
     * @param {string} key The name of the value
     * @param {any} val The actual value of the value
     * @returns {PipelineContext} A reference to itself
     */
    addValue(key, val) {
        this[key] = val;
        return this;
    }

    execute() {
        if (this.state === CTX_INIT) {
            this.state = CTX_RUNNING;
            this.pipeline.execute(this);
        }

        switch (this.state) {
            case CTX_INIT:
                return this.addError('Context was unable to run');

            case CTX_STOPPED:
            case CTX_ERRORED:
                return false;

            case CTX_FINISHED:
                return this.content;

            default:
                return this;
        }
    }

    getFinal() {
        return this.state === CTX_FINISHED ? this.content : false;
    }

    /**
     * Get a value from the context object.
     * @param {any} key The name of the value
     * @returns {any} The value of the value or false if it does not exist.
     */
    getValue(key) {
        return key in this ? this[key] : undefined;
    }

    setContent(options) {
        this.content = options.source || '';
        this.resolvedName = options.sourceFile;
        this.exists = true;
        this.isEval = false;

        let n = (this.filename = options.file).lastIndexOf('/'),
            p = this.filename.lastIndexOf('.');

        this.directory = this.filename.slice(0, n);
        this.extension = this.filename.slice(p);
        this.filename = this.basename = this.filename.slice(0, p);
        this.exists = true;

        delete options.source;
        delete options.sourceFile;

        return this;
    }


    update(state, content) {
        if (state !== this.state && state === CTX_RUNNING && !this.content) {
            try {
                this.content = driver.config.stripBOM(fs.readFileSync(this.resolvedName, 'utf8') || '');
            }
            catch (e) {
                console.log('update failure');
            }
        }
        if(content) this.content = content;
        return (this.state = state), this;
    }

    /**
     * Checks to see if the specified file exists with the given extension.
     * @param {any} ext
     * @returns {boolean} 
     */
    validExtension(ext) {
        if (!this.content) {
            if ((ext = ext || this.extension) === false)
                return false;
            let tryFilename = this.filename.endsWith(ext) ? this.filename : this.filename + ext;
            /** @type {FileSystemStat} */
            let stat = driver.efuns.stat(tryFilename, MUDFS.StatFlags.Content);
            if (stat && stat.exists) {
                if (stat.isFile) {
                    let n = this.filename.lastIndexOf('/');

                    this.extension = ext;
                    this.filename = this.basename;
                    this.lastModified = stat.mtime;
                    this.exists = true;
                    this.directory = this.filename.slice(0, n);
                    this.resolvedName = this.realName.endsWith(ext) ? this.realName : (this.realName += ext);
                    this.isEval = false;
                    this.content = stat.content;

                    return true;
                }
            }
            return false;
        }
        return true;
    }

    /**
     * Checks to see if the specified file exists with the given extension.
     * @param {any} ext
     * @returns {boolean} 
     */
    async validExtensionAsync(ext) {
        if (!this.content) {
            if ((ext = ext || this.extension) === false)
                return false;
            let tryFilename = this.filename.endsWith(ext) ? this.filename : this.filename + ext,
                stat = await driver.efuns.fs.statAsync(tryFilename, MUDFS.StatFlags.Content);
            if (stat && stat.exists) {
                if (stat.isFile) {
                    let n = this.filename.lastIndexOf('/');

                    this.extension = ext;
                    this.filename = this.basename;
                    this.lastModified = stat.mtime;
                    this.exists = true;
                    this.directory = this.filename.slice(0, n);
                    this.resolvedName = this.realName.endsWith(ext) ? this.realName : this.realName + ext;
                    this.isEval = false;
                    this.content = await stat.readAsync(undefined, true);

                    return true;
                }
            }
            return false;
        }
        return true;
    }

    virtualContext(virtualData) {
        if (virtualData) {
            this.baseName = virtualData.baseName;
            this.directory = this.baseName.slice(0, this.baseName.lastIndexOf('/'));
            this.realName = driver.fileManager.toRealPath(virtualData.baseName);
        }
    }
}

module.exports = {
    PipelineContext: PipelineContext,
    CTX_INIT: CTX_INIT,
    CTX_RUNNING: CTX_RUNNING,
    CTX_STOPPED: CTX_STOPPED,
    CTX_ERRORED: CTX_ERRORED,
    CTX_FINISHED: 4
};
