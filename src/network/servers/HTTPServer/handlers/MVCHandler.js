/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: Resolves and executes MVC requests for a server.
 */

const
    { HTTPContext } = require('../HTTPContext'),
    BaseContentHandler = require('./BaseContentHandler');

class KMTemplateHandler extends BaseContentHandler {
    /**
     * Serve up a static file
     * @param {HTTPContext} context The context being served.
     */
    executeHandler(context) {

    }
}

module.exports = KMTemplateHandler;
