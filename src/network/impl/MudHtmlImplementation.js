/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: December 25, 2017
 *
 * Provides a base abstraction for rendering HTML content for the client.
 */

const
    ElementRegex = /(<[\/]{0,1}[a-zA-Z0-9]+[^>]*>)/g,
    ClientImplementation = require('./ClientImplementation');


class MudHtmlImplementation extends ClientImplementation {
    /**
     * Render HTML text for a non-HTML client.
     * @param {string} text The text that may contain HTML.
     */
    renderHtml(text) {
        return text.replace(ElementRegex, '');
    }

    /**
     * 
     * @param {Object.<string,boolean>} flags
     */
    updateSupportFlags(flags) {
        flags.htmlEnabled = false;
    }
}

MudHtmlImplementation.createImplementation = function (caps) {
    let implementationType = MudHtmlImplementation;
    switch (caps.terminalType) {
        case 'html':
        case 'kmud':
            implementationType = require('./kmud/KmudHtmlSupport');
            break;
    }
    return new implementationType(caps);
}

module.exports = MudHtmlImplementation;
