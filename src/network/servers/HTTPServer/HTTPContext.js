/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: Placeholder for future MVC-based server.
 */
const
    http = require('http'),
    HTTPUri = require('./HTTPUri');

/**
 * @typedef {Object} HttpServerOptions 
 * @property {number} [port=8088] The HTTP port to listen on.  Set to false if unwanted.
 * @property {http.ServerOptions & {host: string}} [portOptions]
 * @property {number} [securePort=false] The secure port to listen on.  Set to false if unwanted.
 * @property {https.ServerOptions} secureOptions The location of the cert for secure connections (required if securePort is enabled)
 * @property {string[]} controllerSearchPath Directories in which to search for MVC controllers.
 * @property {string} staticRoot The root directory for static content
 */

class HTTPRequest extends http.IncomingMessage {
    constructor(...args) {
        super(...args);

        this.queryString = {};
        this.urlParsed = new HTTPUri();
    }

    get httpMethod() {
        return this.method;
    }
}

class HTTPResponse extends http.ServerResponse {
    constructor(...args) {
        super(...args);
    }
}

class HTTPContext {
    /**
     * 
     * @param {HTTPRequest} request The client request
     * @param {HTTPResponse} response The server response
     */
    constructor(request, response) {
        this.request = request;
        this.response = response;
    }
}

module.exports = {
    HTTPRequest,
    HTTPResponse,
    HTTPContext
};
