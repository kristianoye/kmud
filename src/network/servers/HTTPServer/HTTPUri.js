/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: Placeholder for future MVC-based server.
 */
const
    path = require('path');

class HTTPUri {
    /**
     * Construct a new URI object
     * @param {string} url The raw URL
     */
    constructor(url, staticRoot = false) {
        this.absolutePath = '/';
        this.localPath = '/';
        this.host = 'localhost';
        this.port = 80;
        this.queryString = {};
        this.scheme = 'http';
        /** @type {fs.Stats} */
        this.stat = {
            isFile: () => false,
            isDirectory: () => false,
            mtime: new Date(),
            mtimeMs: new Date().getTime()
        };
        this.exists = false;
        this.resolved = false;
        this.validLocation = false;

        if (url) {
            let parts = url.split('/'),
                authority = parts[2],
                [host, port] = authority.split(':', 2),
                pathAndQuery = '/' + parts.slice(3).join('/'),
                sqs = pathAndQuery.indexOf('?');

            this.absolutePath = pathAndQuery;
            this.authority = parts[2];
            this.host = host;
            this.pathAndQuery = pathAndQuery;
            this.scheme = parts[0].slice(0, -1);
            this.port = port ? parseInt(port) : this.scheme === 'http' ? 80 : 443;
            this.query = pathAndQuery.slice(sqs);

            if (sqs > -1) {
                this.absolutePath = pathAndQuery.slice(0, sqs);
                this.query.slice(1).split('&').forEach(p => {
                    let [key, value] = p.split('=', 2);
                    if (key in this.queryString === false)
                        this.queryString[key] = value;
                    else if (Array.isArray(this.queryString[key]))
                        this.queryString[key].push(value);
                    else {
                        this.queryString[key] = [this.queryString[key]];
                        this.queryString[key].push(value);
                    }
                });
            }
            this.segments = this.absolutePath.split('/').filter(s => s.length);
            this.localPath = this.absolutePath;
        }
    }

    /** @type {string} */
    get extension() {
        let n = this.localPath.lastIndexOf('.');
        return n > -1 ? this.localPath.slice(n) : '';
    }
}


/**
 * 
 * @param {any} arg
 * @param {function(HTTPUri): string} resolver A function to resolve virtual to physical paths
 * @param {boolean} [isSecure=false] Indicates whether HTTPS is being used
 */
HTTPUri.parse = async function (arg, resolver = false, isSecure = false) {
    if (typeof arg === 'object') {
        let scheme = isSecure ? 'https' : 'http',
            url = `${scheme}://${arg.headers.host}${arg.url}`,
            result = arg.urlParsed = new HTTPUri(url);

        return !!resolver && resolver(arg) || result;
    }
    else if (typeof arg === 'string')
        return new HTTPUri(arg);
    else
        throw new Error(`Unexpected parameter to HTTPUri.parse(); Expected string | object but got ${typeof arg}`);
};


module.exports = HTTPUri;
