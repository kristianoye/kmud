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
    constructor(caps) {
        super(caps);
        this.caps.html = this.client.html = this;
    }
    /**
     * Render HTML text for a non-HTML client.
     * @param {string} text The text that may contain HTML.
     */
    renderHtml(text) {
        let para = (text || '').split(/(?:<p\s+[^>]*>|<p>|<\/p>)/i);
        if (para.length > 1) {
            let result = para.map(s => {
                let foo = s.replace(ElementRegex, '')
                    .replace(/\s+/g, ' ').trim();
                return foo;
            }).join(efuns.eol) + efuns.eol;

            return result;
        }
        return text || '';
    }

    /**
     * 
     * @param {Object.<string,boolean>} flags
     */
    updateFlags(flags) {
        flags.html = false;
        return this;
    }
}

module.exports = MudHtmlImplementation;
