/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const ClientInstance = require('../../ClientInstance'),
    ClientEndpoint = require('../../ClientEndpoint');

const
    _callbacks = Symbol('callbacks');

class HTTPClientInstance extends ClientInstance {
    /**
     * 
     * @param {ClientEndpoint} endpoint The endpoint 
     * @param {any} client
     */
    constructor(endpoint, client) {
        super(endpoint, client, client.request.connection.remoteAddress);

        this[_callbacks] = {};

        client.echoing = true; // total hack for now
        client.on('disconnect', msg => this.disconnect('http', msg));
        client.on('kmud', data => {
            switch (data.type) {
                case 'consoleInput':
                    let text = data.toString('utf8');
                    return this.enqueueCommand(data.eventData.cmdline);

                default:
                    let type = data.type,
                        callback = this[_callbacks][type];

                    if (callback) {
                        callback.call(this.body(), data);
                    }
                    break;
            }
            let ctx = driver.getContext(true, ctx => {
                ctx.note = 'HTTPClientInstance.on';
                ctx.thisPlayer = this.body();
                ctx.truePlayer = ctx.thisPlayer;
            });
            try {
                this.emit('kmud', data);
            }
            catch (err) {
                this.writeLine(err.message);
            }
            finally {
                if (ctx.refCount > 0) ctx.release();
            }
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

    get clientType() { return 'html'; }

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
        var prompt = Object.assign({
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
        if (prompt.nostack !== true) this.inputStack.shift(frame);
        return this.renderPrompt(frame);
    }

    close(reason) {
        this.eventSend({
            type: 'kmud.disconnect',
            eventData: reason || '[No Reason Given]'
        });
        this.client.emit('console.disconnect');
        this.client.disconnect();
    }

    /**
     * The default prompt painted on the client when a command completes.
     * @returns {string} Returns the default command prompt text.
     */
    get defaultPrompt() { return 'Enter a command...'; }

    /**
     * @returns {string} Returns the terminal type for this client.
     */
    get defaultTerminalType() { return 'kmud'; }

    /**
     * Write a prompt on the client.
     * @param {MUDInputEvent} evt The current input event data.
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
     * @param {MUDInputEvent} data The data packet to send to the client.
     * @returns {HTTPClientInstance} The current client
     */
    eventSend(data) {
        if (typeof data.type !== 'string')
            throw new Error('Invalid MUD event: ' + JSON.stringify(data));
        this.client.emit('kmud', data);
        return this;
    }

    /**
     * Handle a body switch.
     * @param {MUDInputEvent} evt Handle a body switch.
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
        input && this.eventSend({
            type: 'renderPrompt',
            eventData: input.data
        });
        return this;
    }

    toggleEcho(echoOn = true) {
        // Does not do anything atm
    }

    write(text, opts) {
        var data = Object.assign({
            type: 'text',
            target: 'console.out',
            text: text
        }, opts);

        this.eventSend({
            type: 'consoleText',
            eventData: data
        });
        return this;
    }

    writeLine(text) {
        return this.write(text);
    }
}

module.exports = HTTPClientInstance;