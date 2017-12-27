const
    MUDData = require('../MUDData'),
    CTX_INIT = -1,
    CTX_RUNNING = 1,
    CTX_STOPPED = 2,
    CTX_ERRORED = 3,
    CTX_FINISHED = 4,
    fs = require('fs');

class PipelineContext {
    /**
     * 
     * @param {string} filename The name of the file to be compiled.
     */
    constructor(filename) {
        var n = filename.lastIndexOf('.');

        filename = filename.replace(/\\/g, '/');

        this.extension = n > -1 ? filename.slice(n) : false
        this.basename = n > -1 ? filename.slice(0, n) : filename;
        this.filename = filename;
        this.realName = MUDData.MudPathToRealPath(this.filename);
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
     * @param {string} key
     * @param {any} val
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
     * @param {any} key
     */
    getValue(key) {
        return key in this ? this[key] : false;
    }

    update(state, content) {
        if (state !== this.state && state === CTX_RUNNING) {
            this.content = MUDData.StripBOM(fs.readFileSync(this.resolvedName, 'utf8') || '');
        }
        if(content) this.content = content;
        return (this.state = state), this;
    }

    validExtension(ext) {
        if ((ext = ext || this.extension) === false)
            return false;

        if (fs.existsSync(this.realName + ext)) {
            var stat = fs.statSync(this.resolvedName = this.realName + ext);
            if (stat.isFile()) {
                var n = this.filename.lastIndexOf('/');
                this.extension = ext;
                this.filename = this.basename;
                this.lastModified = stat.mtime;
                this.exists = true;
                this.directory = this.filename.slice(0, n);
                return true;
            }
        }
        return false;
    }

    virtualContext(virtualData) {
        if (virtualData) {
            this.baseName = virtualData.baseName;
            this.directory = this.baseName.slice(0, this.baseName.lastIndexOf('/'));
            this.realName = MUDData.MudPathToRealPath(virtualData.baseName);
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
