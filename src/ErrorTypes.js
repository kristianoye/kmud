/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    util = require('util');

class MUDError extends Error {
    constructor(e) {
        super(e);
    }
}

class SecurityError extends MUDError {
    constructor(e) {
        super(e);
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
    constructor(method) {
        super(`Method ${method} is not implemented.`);
    }
}


module.exports = {
    MUDError,
    MissingConfigError,
    NotImplementedError,
    SecurityError,
    TimeoutError
};
