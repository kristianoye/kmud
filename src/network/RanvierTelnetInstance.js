/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */

const
    ClientInstance = require('./ClientInstance'),
    _client = Symbol('_client'),
    MXC = require('../MXC'),
    maxCommandExecutionTime = driver.config.driver.maxCommandExecutionTime,
    merge = require('merge');

class RanvierTelnetInstance extends ClientInstance {
    constructor(endpoint, client) {
        super(endpoint, client, client.remoteAddress);
        let self = this,
            context = MXC.init(),
            clientHeight = 24,
            clientWidth = 80,
            $storage,
            body;

        this.client.on('data', (buffer) => {
            let text = buffer.toString('utf8');
            this.enqueueCommand(text);
        });
        this.client.on('close', msg => self.disconnect('telnet', msg || 'not specified'));
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

    /**
     * Write a prompt on the client.
     * @param {MUDInputEvent} evt
     */
    displayPrompt(evt) {
        if (this.inputStack.length === 0) {
            this.write(evt.prompt.text);
        }
    }

    addPrompt(opts, callback) {
        if (typeof opts === 'string') {
            opts = { text: opts, type: 'text' };
        }
        var data = merge({
            type: 'text',
            text: 'Command: '
        }, opts), frame = { data: data, callback: callback };

        if (frame.data.error) {
            this.writeLine(frame.data.error);
        }
        this.inputStack.push(frame);
        return this.renderPrompt(frame);
    }

    renderPrompt(input) {
        this.client.toggleEcho(input.data.type !== 'password');
        this.write(input.data.text);
        return this;
    }

    setBody(body, cb) {
        return super.setBody(body, cb);
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
     * @deprecated
     * @param {any} html
     */
    writeHtml(html) {
        this.writeLine(html
            .replace(/<br[\/]{0,1}>/ig, '\\n')
            .replace(/<[^>]+>/g, ''));
    }

    /**
     * 
     * @param {any} text
     */
    writeLine(text) {
        this.write(text + '\n');
    }
}

module.exports = RanvierTelnetInstance;