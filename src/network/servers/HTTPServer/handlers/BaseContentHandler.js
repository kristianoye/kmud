/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: This is a common interface for content handlers in the KMUD web server
 */
const
    { HTTPContext } = require('../HTTPContext');

class BaseContentHandler {
    /**
     * Construct a handler
     * @param {any} server
     * @param {any} context
     */
    constructor(server, context) {
        this.server = server;
        this.context = context || false;
    }

    addPerfStat() {
        throw new Error(`addPerfStat() was not implemented in ${this.constructor.name}`);
    }

    /**
     * Executes the handler for a given context.
     * @param {HTTPContext} context The context that is executing.
     */
    async executeHandler(context) {
        throw new Error(`executeHandler() was not implemented in ${this.constructor.name}`);
    }

    /**
     * Render performance stats to a string or buffer
     */
    renderPerfStats() {
        throw new Error(`renderPerfStats() was not implemented in ${this.constructor.name}`);
    }
}

module.exports = BaseContentHandler;
