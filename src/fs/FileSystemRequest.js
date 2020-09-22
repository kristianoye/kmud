

/**
 * Contains all of the information needed to perform a filesystem operation.
 */
class FileSystemRequest {
    /**
     * Creates a filesystem request.
     * @param {FileSystemRequest} data The data to construct the request with
     */
    constructor(data) {
        this.async = data.isAsync;
        this.expr = data.expr;

        /** @type {string} */
        this.fileName = '';

        /** @type {string} */
        this.fullPath = '';

        /** @type {string} */
        this.relativePath = data.relPath || '';

        /** @type {FileSystem} */
        this.fileSystem = data.fs;

        /** @type {number} */
        this.flags = typeof data.flags === 'string' ? data.flags :
            typeof data.flags === 'number' ? data.flags : 0;

        /** @type {FileSystemObject} */
        this.parent = null;

        /** @type {string} */
        this.pathFull = '';

        /** @type {string} */
        this.pathRel = '';

        /** @type {boolean} */
        this.resolved = false;

        /** @type {string} */
        this.op = data.op || 'unknown';

        /** @type {FileSecurity} */
        this.securityManager = data.fs.securityManager;

        let expr = data.expr, relPath = data.relPath;

        if (!expr.endsWith('/')) {
            let dir = expr.slice(0, expr.lastIndexOf('/')),
                rel = relPath.slice(0, relPath.lastIndexOf('/'));

            this.fileName = expr.slice(dir.length + 1);
            this.fullPath = expr;
            this.relativePath = relPath;
            this.pathFull = dir + (dir.endsWith('/') ? '' : '/');
            this.pathRel = rel + (rel.endsWith('/') ? '' : '/');
        }
        else {
            this.fileName = '';
            this.fullPath = expr;
            this.relativePath = relPath;
            this.pathFull = expr;
            this.pathRel = relPath;
        }
    }

    clone(init) {
        let c = new FileSystemRequest({
            fs: this.fileSystem,
            flags: this.flags,
            op: this.op,
            expr: this.expr,
            relPath: this.relativePath,
            efuns: this.efuns
        });
        init(c);
        return c;
    }

    deny() {
        let procName = this.op.slice(0, 1).toLowerCase() +
            this.op.slice(1) + (this.async ? 'Async' : 'Sync');
        return this.securityManager.denied(procName, this.fullPath);
    }

    /**
     * Determine if a particular bitflag is set
     * @param {number} flag The flag to test
     */
    hasFlag(flag = 0) {
        return flag > 0 && (this.flags & flag) === flag;
    }

    toString() {
        return `FileSystemRequest[${this.op}:${this.fullPath}]`;
    }

    async valid(method) {
        if (method && !method.startsWith('valid'))
            method = 'valid' + method;

        let checkMethod = method || `valid${this.op}`;

        if (typeof this.securityManager[checkMethod] !== 'function')
            throw new Error(`Security method ${checkMethod} not found!`);

        let result = await this.securityManager[checkMethod](this.fullPath);
        return result;
    }
}

module.exports = FileSystemRequest;
