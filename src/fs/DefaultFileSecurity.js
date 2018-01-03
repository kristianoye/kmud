const
    FileSecurity = require('../FileSecurity');

class DefaultFileSecurity extends FileSecurity {
    constructor() {
        super();
    }

    /**
     * Default security does not distinguish creating a file from writing.
     * @param {any} caller
     * @param {string} expr
     */
    validCreateFile(caller, expr) {
        return this.validWrite(caller, expr);
    }

    /**
     * Default security does not distinguish deleting a file from writing.
     * @param {any} caller
     * @param {string} expr
     */
    validDeleteFile(caller, expr) {
        return this.validWrite(caller, expr);
    }

    /**
     * Default security system does not support granting permissions.
     */
    validGrant(caller, expr) {
        throw new Error('Security system does not support the use of grant');
    }

    /**
     * Default security does not distinguish between loading and reading.
     * @param {any} caller
     * @param {string} expr
     */
    validLoadFile(caller, expr) {
        return this.validRead(caller, expr);
    }

    /**
     * Determine if the caller has permission to read a particular file.
     * @param {any} caller
     * @param {any} expr
     */
    validReadFile(caller, expr) {
    }

    /**
     * Determine if the caller has permission to write to the filesystem.
     * @param {any} caller
     * @param {string} expr
     */
    validWriteFile(caller, expr) {

    }
}

module.exports = DefaultFileSecurity;
