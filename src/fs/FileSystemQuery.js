const
    WildcardRegex = /[\*\?\[\]]+/,
    FSQ = require('./FileSystemFlags').FileSystemQueryFlags

class FileSystemQuery {
    /**
     * Construct a query object
     * @param {FileSystemQuery} query
     * @param {number} queryDepth The depth of this query
     */
    constructor(query = {}, queryDepth = 0) {
        /** @type {string} */
        this.absolutePath = query.absolutePath;
        /** @type {string} */
        this.cwd = query.cwd || '/';
        /** @type {string|RegExp|false} */
        this.expression = query.expression || false;
        this.crossFilesystem = query.crossFilesystem !== true;
        this.contains = query.contains || false;
        this.containsPattern = query.containsPattern || false;
        this.containsWildcard = this.expression && FileSystemQuery.containsWildcard(this.expression);
        this.fileManager = query.fileManager || driver.fileManager || false;
        /** @type {string} */
        this.fileSystemId = query.fileSystem.systemId;
        this.flags = typeof query.flags === 'number' ? query.flags : 0;
        /** @type {MUDFileSystem} */
        this.fileSystem = query.fileSystem;
        this.isGlobstar = query.isGlobstar === true;
        this.isSystemRequest = query.isSystemRequest === true;
        this.maxDepth = typeof query.maxDepth === 'number' ? query.maxDepth : 0;
        this.minCreateDate = query.minCreateDate || false;
        this.maxCreateDate = query.maxCreateDate || false;
        this.minModifyDate = query.minModifyDate || false;
        this.maxModifyDate = query.maxModifyDate || false;
        this.minSize = query.minSize || false;
        this.maxSize = query.maxSize || false;
        /** 
         * Callback for reporting errors
         * @type {function(string, string, string)}
         */
        this.onError = query.onError || false;
        this.path = query.path || false;
        this.queryDepth = queryDepth;
        this.relativePath = query.relativePath || '/';
    }

    /** Determine if we want to prevent going any deeper into the hierarchy */
    get atMaxDepth() {
        return this.maxDepth > 0 && this.queryDepth >= this.maxDepth;
    }

    /**
     * Attempt to create a regular expression from a file pattern
     * @param {string} str The string to convert
     * @param {boolean} exactMatch The pattern must match exactly
     */
    static buildRegexExpression(str, exactMatch = true) {
        str = str.replace(/\]/g, ']{1}')
        str = str.replace(/\//g, '\\/');
        str = str.replace(/\./g, '\\.');
        str = str.replace(/[*]+/g, '[^/]+');
        str = str.replace(/\?/g, '.');
        try {
            if (exactMatch)
                return new RegExp('^' + str + '$');
            else
                return new RegExp(str + '$');
        }
        catch (err) {
            console.log(err);
        }
        return false;
    }

    /**
     * Clone the request
     * @param {FileSystemQuery?} overrides
     */
    clone(overrides = {}) {
        let clone = new FileSystemQuery(Object.assign({}, this, overrides || {}), this.queryDepth);
        return clone;
    }

    /**
     * Does a string contain wildcards?
     * @param {string} expr The expression to check
     */
    static containsWildcard(expr) {
        return typeof expr === 'string' && WildcardRegex.test(expr);
    }

    /**
     * Execute the query
     */
    executeAsync() {
        if (this.isGlobstar)
            return this.executeGlobstarAsync();

        return new Promise(async (resolve, reject) => {
            try {
                let results = await this.fileSystem.queryFileSystemAsync(this);
            }
            catch (ex) {
                reject(ex);
            }
        });
    }

    executeGlobstarAsync() {
        return new Promise(async (resolve, reject) => {
            try {
                let query = this.clone({
                    isGlobstar: false,
                    flags: this.flags | FSQ.Recursive | FSQ.GetFiles | FSQ.GetDirectories,
                    expression: false // get all
                });
                let results = await query.executeAsync();
                resolve(results);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Get the path parts of the query
     * @param {string} expr
     * @type {string[]}
     */
    static getParts(expr) {
        if (!expr || typeof expr !== 'string')
            return [];

        return expr
            .split('/')
            .filter(s => s.length > 0)
    }

    hasFlag(flag) {
        return (this.flags & flag) > 0;
    }

    /**
     * Get the path parts of the query
     * @type {string[]}
     */
    get parts() {
        return FileSystemQuery.getParts(this.expression);
    }
}

module.exports = FileSystemQuery;
