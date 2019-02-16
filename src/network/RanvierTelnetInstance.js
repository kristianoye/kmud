/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */

const
    ClientInstance = require('./ClientInstance');

class RanvierTelnetInstance extends ClientInstance {
    constructor(endpoint, client) {
        super(endpoint, client, client.remoteAddress);
        this.client.on('data', (buffer) => this.enqueueCommand(buffer.toString('utf8')));
        this.client.on('close', msg => this.disconnect('telnet', msg || 'not specified'));
    }

    eventSend(data) {
        switch (data.eventType) {
            case 'clearScreen':
                this.write("%^INITTERM%^");
                break;
        }
    }

    get isBrowser() { return false; }

    close() {
        this['__closed__'] = true;
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
            this.writeLine('\n' + frame.error.trim() + '\n');
        }
        this.inputStack.unshift(frame);
        return opts.drawPrompt === true ? this.renderPrompt(frame) : this;
    }

    renderPrompt(input) {
        input = this.inputStack[0] || input;
        if (input) {
            this.client.toggleEcho(input.type !== 'password');
            this.write(input.text);
        }
        else {
            this.client.toggleEcho(true);
            this.write(this.body().defaultPrompt || '> ')
        }
        return this;
    }

    transmit(buffer) {
        let active = !(this['__closed__'] || false);
        let foo = buffer.toString('utf8');
        if (active) this.client.transmit(buffer);
    }

    write(text) {
        let active = !(this['__closed__'] || false);
        text = this.caps.html.renderHtml(text);
        text = this.caps.color.expandColors(text);
        if (active) this.client.write(text);
    }

    /**
     * Render a line of text to the client.
     * @param {string} text The text to render on the client.
     */
    writeLine(text) {
        this.write(text + '\n');
    }
}

module.exports = RanvierTelnetInstance;