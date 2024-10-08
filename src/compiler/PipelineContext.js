﻿const { ExecutionContext, CallOrigin } = require('../ExecutionContext');

const
    CTX_INIT = -1,
    CTX_RUNNING = 1,
    CTX_STOPPED = 2,
    CTX_ERRORED = 3,
    CTX_FINISHED = 4,
    fs = require('fs');

class PipelineContext {
    /**
     * 
     * @param {MUDCompilerOptions} options The name of the file to be compiled.
     * @param {boolean} [isEval] Indicates the code is from eval()
     * @param {string} [content] The source code
     */
    constructor(options, isEval = false, content = undefined) {
        let file = options.fileObject || options.file;

        this.isEval = isEval === true;
        this.isVirtual = options.isVirtual === true;
        this.options = options;

        if (typeof file === 'string') {
            let n = file && file.lastIndexOf('.') || -1;

            file = file.replace(/\\/g, '/');

            this.basename = n > -1 ? file.slice(0, n) : file;
            this.content = '';
            this.exists = false;
            this.extension = n > -1 ? file.slice(n) : false
            this.filename = this.fullPath = file;
            if (this.isEval === false)
                this.realName = driver.fileManager.toRealPath(this.filename);
            this.resolvedName = false;
        }
        else {
            this.basename = file.baseName;
            this.content = content || '';
            this.directory = file.directory;
            this.exists = file.exists();
            this.extension = file.extension;
            this.filename = file.baseName;
            this.fullPath = file.fullPath;
            this.realPath = driver.fileManager.toRealPath(file.path);;
            this.resolvedName = this.realPath;
        }
        this.filename = this.fullPath;
        this.errors = [];
        this.state = CTX_INIT;
        this.module = !isEval && driver.cache.get(this.fullPath);
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

    /**
     * Create a context
     * @param {ExecutionContext} ecc
     * @param {MUDCompilerOptions} options The file expression to build a context for
     * @param {string} possibleExtensions A list of expressions to search for
     */
    static async create(ecc, options, possibleExtensions = '') {
        let frame = ecc.push({ file: __filename, method: 'create', isAsync: true, callType: CallOrigin.Driver });
        try {
            let expr = options.file,
                directory = expr.slice(0, expr.lastIndexOf('/')),
                fileExpression = expr.slice(expr.lastIndexOf('/') + 1),
                hasExtension = new RegExp(possibleExtensions).test(fileExpression),
                fileToUse;

            if (!hasExtension) {
                let directoryObject = await driver.fileManager.getObjectAsync(frame.branch(), directory, 0, true),
                    filterExpr = fileExpression + possibleExtensions,
                    files = await directoryObject.readAsync(frame.branch(), filterExpr);

                fileToUse = files.firstOrDefault();
            }
            else
                fileToUse = await driver.fileManager.getObjectAsync(frame.branch(), options.file, 0, true);

            if (fileToUse) {
                let content = await fileToUse.readAsync(frame.branch());

                options.fileObject = fileToUse;

                return new PipelineContext(options, false, content);
            }
            else
                return new PipelineContext(options);
        }
        finally {
            frame.pop();
        }
        return new PipelineContext(options);
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
        if (content) this.content = content;
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
            /** @type {FileSystemObject} */
            let stat = driver.efuns.stat(tryFilename, MUDFS.StatFlags.Content);
            if (stat && stat.exists()) {
                if (stat.isFile()) {
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
            try {
                let tryFilename = this.filename.endsWith(ext) ? this.filename : this.filename + ext,
                    fileObject = await driver.efuns.fs.getObjectAsync(tryFilename);
                if (fileObject.exists()) {
                    this.extension = fileObject.extension;
                    this.filename = fileObject.baseName;
                    this.lastModified = fileObject.mtime;
                    this.exists = fileObject.exists();
                    this.directory = fileObject.directory;
                    this.resolvedName = this.realName.endsWith(ext) ? this.realName : this.realName + ext;
                    this.isEval = false;
                    this.content = await fileObject.readAsync(undefined, true);

                    return true;
                }
            }
            catch (e) { }
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
    PipelineContext,
    CTX_INIT: CTX_INIT,
    CTX_RUNNING: CTX_RUNNING,
    CTX_STOPPED: CTX_STOPPED,
    CTX_ERRORED: CTX_ERRORED,
    CTX_FINISHED: 4
};
