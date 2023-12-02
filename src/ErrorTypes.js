const { extend } = require("lodash");
const { construct } = require("../node_modules/js-yaml/lib/js-yaml/type/str");

/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
class MUDError extends Error {
    constructor(e) {
        super(e);
    }
}

class CompositeError extends MUDError {
    constructor(e, errors = []) {
        super(e);
        this.errors = errors;
    }

    get length() {
        return this.errors.length;
    }

    getError(n) {
        if (typeof n === 'number' && n > -1 && n < this.length)
            return this.errors[n];
        else
            return undefined;
    }

    /**
     * Get iterator to traverse errors
     * @returns {Generator<MUDError>}
     */
    *getItems() {
        for (const error of this.errors)
            yield error;
    }
}

class PermissionDeniedError extends MUDError {
    constructor(file, method) {
        super(`${file}: ${method}: Permission denied`);
    }
}

class SecurityError extends MUDError {
    constructor(e) {
        super(e);
    }
}

class SyntaxError extends MUDError {
    /**
     * 
     * @param {string} msg string
     * @param {{ line: number, char: number, file: string }} pos The position at which the error occurred
     */
    constructor(msg, pos) {
        super(msg);
        this.position = pos;
    }
}

/**
 * Something took too long
 */
class TimeoutError extends MUDError {
    constructor(msg) {
        super(msg);
    }
}

class MissingConfigError extends MUDError {
    constructor(e) {
        super(`Configuration parameter ${e} was not defined.`);
    }
}

class NotImplementedError extends MUDError {
    /**
     * Construct an exception
     * @param {string} method The name of the method lacking an implementation
     * @param {object} definingType
     * @param {'Method'|'Property'} type
     */
    constructor(method, definingType = false, type = 'Method') {
        if (definingType)
            super(`${type} ${definingType.constructor.name}.${method} is not implemented.`);
        else
            super(`${type} ${method} is not implemented.`);
    }
}


module.exports = {
    MUDError,
    MissingConfigError,
    NotImplementedError,
    SecurityError,
    TimeoutError,
    PermissionDeniedError,
    SyntaxError,
    CompositeError
};
