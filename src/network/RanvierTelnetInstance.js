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
    tripwire = maxCommandExecutionTime > 0 ? require('tripwire') : false;

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
            //dispatchInput.call(this, buffer.toString('utf8'));
        });

        this.client.on('close', () => {
            this.emit('kmud.connection.closed', this, 'telnet');
            this.emit('disconnected', this);
        });
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

    addPrompt(opts, callback) {
        if (typeof opts === 'string') {
            opts = { text: opts, type: 'text' };
        }
        var data = Object.extend({
            type: 'text',
            text: 'Command: '
        }, opts), frame = { data: data, callback: callback };

        if (frame.data.error) {
            this.writeLine(frame.data.error);
        }
        this.client.toggleEcho(data.type !== 'password');
        this.write(frame.data.text);
        this.inputStack.push(frame);
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