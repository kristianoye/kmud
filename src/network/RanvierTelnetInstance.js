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
        this.client.on('data', (buffer) => {
            let line = buffer.toString('utf8');
            this.emit('data', line);
            this.enqueueCommand(line);
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

    get isBrowser() { return false; }

    close() {
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
            this.writeLine('\n' + frame.error.trim() + '\n');
        }
        this.inputStack.unshift(frame);
        return opts.drawPrompt === true ? this.renderPrompt(frame) : this;
    }

    /**
     * Called to allow standardization of input based on the type of "dialog"
     * @param {{ type: string }} input The modal input settings from the input frame.
     * @param {string} text The raw user input
     * @returns {any} The 
     */
    normalizeInput(input, text) {
        if (input.type === 'text')
            return text;

        else if (input.type === 'password') {
            this.toggleEcho(true);
            this.write('\r\n');
            return text;
        }

        else if (input.type === 'yesno') {
            let resp = text.toLowerCase().trim();
            if (resp.length === 0 && input.default)
                return input.default;
            else if (['yes', 'no', 'y', 'n'].indexOf(resp) === -1) {
                this.writeLine(input.error || '\nPlease respond with "yes" or "no"\n\n');
                return undefined;
            }
            else
                return resp.charAt(0) === 'y' ? 'yes' : 'no';
        }
        else if (input.type === 'pickOne') {
            let opts = Object.keys(input.options);
            let disp = opts.slice(0, -1).join(', ') + ' or ' + opts.pop();
            let values = opts.map(key => input.options[key])
                .filter(val => text.length > 0 && val.slice(0, text.length) === text);

            if (input.options[text])
                return input.options[text];
            else if (values.length === 1)
                return values[0];
            else {
                this.writeLine(input.error || `\nPlease select an item from the list (${disp}).\n\n`);
                return undefined;
            }
        }
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
        this.write(!efuns.text.trailingNewline(text) ? text + '\n' : text);
    }
}

module.exports = RanvierTelnetInstance;