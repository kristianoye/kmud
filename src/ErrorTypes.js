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

class SecurityError extends MUDError
{
    constructor(e) {
        super(e);
    }
}

class BadModuleError extends MUDError {
    constructor(e) {
        super(e);
    }
}

class MissingConfigError extends MUDError {
    constructor(e) {
        super(e);
    }
}


module.exports = {
    BadModuleError: BadModuleError,
    MissingConfigError: MissingConfigError,
    MUDError: MUDError,
    SecurityError: SecurityError
};
