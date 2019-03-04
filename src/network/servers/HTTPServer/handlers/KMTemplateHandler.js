/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: Simple template engine for KMUD
 */

const
    { HTTPContext } = require('../HTTPContext'),
    BaseContentHandler = require('./BaseContentHandler'),
    _ = require('lodash');

class KMTemplateHandler extends BaseContentHandler {
    constructor(server, context) {
        super(server, context);
        /** @type {Object.<string, _.TemplateExecutor>} */
        this.templateCache = {};
    }

    /**
     * Serve up a static file
     * @param {HTTPContext} context The context being served.
     */
    async executeHandler(context) {
        let url = context.request.urlParsed;
        let templateFile = url.localPath,
            template = this.templateCache[url.localPath] || false;

        if (url.localPath in this.templateCache === false) {
            let error = false,
                source = await this.server.readFile(url.localPath, 'utf8')
                    .catch(e => { error = e });

            if (error) throw error;
            template = this.templateCache[url.localPath] = _.template(source);
        }

        let content = template(context.request || {});
    }
}

module.exports = KMTemplateHandler;
