/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: This handler dumps common file types to the client
 */

const
    { HTTPContext } = require('../HTTPContext'),
    KnownMimeTypes = require('../KnownMimeTypes'),
    BaseContentHandler = require('./BaseContentHandler'),
    fs = require('fs');

class StaticContentHandler extends BaseContentHandler {
    /**
     * Serve up a static file
     * @param {HTTPContext} context The context being served.
     */
    async executeHandler(context) {
        let request = context.request,
            response = context.response,
            url = request.urlParsed,
            localPath = url.localPath,
            server = context.server,
            stat = url.stat;


        let lastModified = request.headers["if-modified-since"];
        if (lastModified) {
            let lm = new Date(lastModified);
            if (lm && lm.getTime() >= parseInt(stat.mtimeMs)) {
                response.writeHead(304, 'Not Modified');
                return response.end();
            }
        }
        fs.readFile(localPath, (err, buff) => {
            if (!err) {
                response.mimeType = KnownMimeTypes.resolve(url.extension);

                response.writeHead(200, 'OK', {
                    'Content-Type': response.mimeType.type,
                    'Last-Modified': stat.mtime.toISOString()
                });
                response.write(buff);
                response.end();
            }
            else
                server.sendErrorFile(response, 500);
        });
        return true;
    }
}

module.exports = new StaticContentHandler();
