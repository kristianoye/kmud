const
    MUDEventEmitter = require('./MUDEventEmitter'),
    { NotImplementedError } = require('./ErrorTypes');

class FileSecurity extends MUDEventEmitter {
    constructor() {
        super();
    }

    validCreateDirectory(caller, expr) {
        throw new NotImplementedError('validCreateDirectory');
    }

    validCreateFile(caller, expr) {
        throw new NotImplementedError('validCreateFile');
    }

    validDelete(caller, expr) {
        throw new NotImplementedError('validDelete');
    }

    validDeleteDirectory(caller, expr) {
        throw new NotImplementedError('validDeleteDirectory');
    }

    validDestruct(caller, expr) {
        throw new NotImplementedError('validDestruct');
    }

    validGrant(caller, expr) {
        throw new NotImplementedError('validGrant');
    }

    validListDirectory(caller, expr) {
        throw new NotImplementedError('validListDirectory');
    }

    validLoadFile(caller, expr) {
        throw new NotImplementedError('validLoadFile');
    }

    validRead(caller, expr) {
        throw new NotImplementedError('validRead');
    }

    validReadDir(caller, expr) {
        throw new NotImplementedError('validReadDir');
    }

    validReadPermissions(caller, expr) {
        throw new NotImplementedError('validReadPermissions');
    }

    /**
     * Validate the request to stat a file.
     * @param {any} caller The object or filename requesting the stat.
     * @param {string} expr The file expression to stat.
     * @param {number=} flags Optional detail flags
     * @returns {boolean} True if the caller has permission to perform the operation.
     */
    validStatFile(caller, expr, flags) {
        throw new NotImplementedError('validStatFile');
    }

    /**
     * Validate a write operation.
     * @param {any} caller The caller attempting to write.
     * @param {string} expr The file expression to try and write to.
     */
    validWrite(caller, expr) {
        throw new NotImplementedError('validWrite');
    }
}

module.exports = FileSecurity;
