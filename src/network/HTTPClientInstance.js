/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const ClientInstance = require('./ClientInstance'),
    merge = require('merge');

const
    _client = Symbol('client'),
    _callbacks = Symbol('callbacks'),
    MUDEventEmitter = require('../MUDEventEmitter');

class HTTPClientInstance extends ClientInstance {
    constructor(endpoint, client) {
        super(endpoint, client, client.request.connection.remoteAddress);

        var self = this, body, $storage;

        this[_callbacks] = {};
        client.echoing = true; // total hack for now

        client.on('disconnect', client => {
            self.emit('disconnected', self);
            driver.removePlayer(self.body);
        });

        client.on('kmud', data => {
            switch (data.eventType) {
                case 'consoleInput':
                    let text = data.toString('utf8');
                    return this.enqueueCommand(data.eventData.cmdline);

                default:
                    var eventType = data.eventType,
                        callback = self[_callbacks][eventType];

                    if (callback) {
                        callback.call(self.body(), data);
                    }
                    break;
            }
            self.emit('kmud', data);
        });

        Object.defineProperties(this, {
            height: {
                get: function () { return 24; }
            },
            width: {
                get: function () { return 80; }
            }
        });
    }

    /**
     * Indicates this client is capable of rendering HTML
     * @returns {boolean} Flag indicating the client understands HTML
     */
    get isBrowser() {
        return true;
    }

    /**
     * Prompts the user for input
     * @param {Object} opts Options to include in the prompt request.
     * @param {String} opts.type The type of prompt.  May be 'text' or 'password'.
     * @param {String} opts.text The text to display to the user when prompting.
     * @param {Function} callback A function that catches the user's input.
     * @returns {HTTPClientInstance} A reference to the client interface.
     */
    addPrompt(opts, callback) {
        var prompt = merge({
            type: 'text',
            target: 'console.prompt',
            text: 'Enter a command...'
        }, opts);
        if (typeof prompt.text === 'function') {
            prompt.text = prompt.text.call(this.body());
        }
        var frame = {
            data: prompt,
            callback: callback
        };
        if (prompt.nostack !== true) this.inputStack.push(frame);
        return this.renderPrompt(frame);
    }

    close(reason) {
        this.eventSend({
            eventType: 'kmud.disconnect',
            eventData: reason || '[No Reason Given]'
        });
        this.client.emit('console.disconnect');
        this.client.disconnect();
    }

    /**
     * The default prompt painted on the client when a command completes.
     * @returns {string}
     */
    get defaultPrompt() { return 'Enter a command...'; }

    /**
     * @returns {string}
     */
    get defaultTerminalType() { return 'kmud'; }

    /**
     * Write a prompt on the client.
     * @param {MUDInputEvent} evt
     */
    displayPrompt(evt) {
        if (this.inputStack.length === 0) {
            this.addPrompt({
                type: 'text',
                nostack: true,
                text: evt.prompt.text,
                target: 'console.prompt'
            });
        }
    }

    /**
     * Send an arbitrary event to the client.
     * @param {any} data
     */
    eventSend(data) {
        if (typeof data.eventType !== 'string')
            throw new Error('Invalid MUD event: ' + JSON.stringify(data));
        this.client.emit('kmud', data);
        return this;
    }

    /**
     * 
     * @param {any} evt
     */
    handleExec(evt) {
        super.handleExec(evt);
        if (evt.oldBody) {
            this.addPrompt({
                type: 'text',
                nostack: true,
                text: this.defaultPrompt,
                target: 'console.prompt'
            });
        }
    }

    registerCallback(name, callback) {
        this[_callbacks][name] = callback;
    }

    renderPrompt(input) {
        return this.eventSend({
            eventType: 'renderPrompt',
            eventData: input.data
        });
    }

    write(text, opts) {
        var data = merge({
            type: 'text',
            target: 'console.out',
            text: text
        }, opts);

        this.eventSend({
            eventType: 'consoleText',
            eventData: data
        });
        return this;
    }

    writeHtml(html, opts) {
        return this.eventSend(merge({
            eventType: 'consoleHtml',
            eventData: html
        }, opts)), this;
    }

    writeLine(text) {
        return this.write(text);
    }
}

module.exports = HTTPClientInstance;