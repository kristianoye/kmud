/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */

const
    ClientInstance = require('../../ClientInstance');

class RanvierTelnetInstance extends ClientInstance {
    constructor(endpoint, client) {
        super(endpoint, client, client.remoteAddress);
        this.client.on('data', (buffer) => {
            this.emit('data', buffer.toString('utf8'));
        });
        this.client.on('close', msg => {
            this.disconnect('telnet', msg || 'not specified');
        });
        this.client.on('drain', () => {
            this.emit('drain');
        });
        this.closed = false;
    }

    eventSend(data) {
        switch (data.eventType) {
            case 'clearScreen':
                this.write("%^INITTERM%^");
                break;
        }
    }

    get isBrowser() {
        return false;
    }

    /*
     *  Programatically disconnect the client from the server.
     */
    close() {
        this.writeLine('Good-bye!');
        this.closed = true;
        this.client.end();
    }

    displayPrompt(evt) {
        if (this.inputStack.length === 0 && evt.prompt) {
            this.write(evt.prompt.text);
        }
        else if (this.inputStack.length === 1) {
            this.renderPrompt(this.inputStack[0]);
        }
    }

    addPrompt(opts, callback) {
        if (typeof opts === 'string') {
            opts = { text: opts, type: 'text', callback };
        }
        let frame = Object.assign({ type: 'text', text: '> ', callback }, opts);

        if (frame.error) {
            this.write(efuns.eol + frame.error.trim() + efuns.eol);
        }
        this.inputStack.unshift(frame);
        return opts.drawPrompt === true ? this.renderPrompt(frame) : this;
    }

    transmit(buffer) {
        if (!this.closed) this.client.transmit(buffer);
    }

    get writable() {
        return !this.closed && this.client.writable;
    }

    write(text) {
        if (!this.closed) {
            text = this.caps.html.renderHtml(text);
            text = this.caps.color.expandColors(text);
            return this.client.write(text);
        }
        return false;
    }

    /**
     * Render a line of text to the client.
     * @param {string} text The text to render on the client.
     */
    writeLine(text) {
        this.write(!efuns.text.trailingNewline(text) ?
            text + efuns.eol : text);
    }
}

module.exports = RanvierTelnetInstance;
