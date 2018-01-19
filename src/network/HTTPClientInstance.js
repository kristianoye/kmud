/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const ClientInstance = require('./ClientInstance'),
    tripwire = false; // require('tripwire');

const
    _client = Symbol('client'),
    _callbacks = Symbol('callbacks'),
    MUDEventEmitter = require('../MUDEventEmitter');

class HTTPClientInstance extends ClientInstance {

    createCommandEvent(input, callback) {
        if (!callback) {
            callback = function (evt) {
                if (!evt.prompt.recapture) {
                    this.renderPrompt(evt.prompt);
                }
            };
        }
        return super.createCommandEvent(input, callback, 'Enter a command...');
    }
    constructor(endpoint, gameMaster, client) {
        super(endpoint, gameMaster, client, client.request.connection.remoteAddress);

        var self = this, body, $storage;

        this[_callbacks] = {};

        function commandComplete(evt) {
            if (!evt.prompt.recapture) {
                self.renderPrompt(evt.prompt);
            }
        }

        function dispatchInput(resp) {
            let evt = self.createCommandEvent(resp.cmdline, commandComplete, 'Enter a command...');
            try {
                var body = this.body;

                gameMaster.setThisPlayer(body(), true);

                if (tripwire) {
                    tripwire.resetTripwire(2000, {
                        player: body(),
                        input: resp
                    });
                }

                if (this.inputStack.length > 0) {
                    var p = this.inputStack.pop();

                    // The function needs to be put back on the stack
                    if (resp.simpleForm) {
                        var result;
                        try {
                            result = p.callback.call(body(), resp.cmdline);
                        }
                        catch (_err) {
                            this.writeLine(_err.message);
                            this.writeLine(_err.stack);
                            result = true;
                        }
                        if (result === true) {
                            //  Put the input frame back on the stack
                            this.inputStack.push(p);
                            this.renderPrompt(p);
                        }
                    }
                }
                else {
                    $storage.emit('kmud.command', evt);
                }
            }
            catch (err) {
                this.eventSend({
                    eventType: 'remoteError',
                    eventData: {
                        message: 'An error occurred processing your request; Please try again.'
                    }
                });
                if (evt) evt.callback(evt);
                driver.errorHandler(err, false);
            }
            finally {
                gameMaster.setThisPlayer(false, true);
            }
        }

        client.on('disconnect', client => {
            self.emit('disconnected', self);
            gameMaster.removePlayer(self.body);
        });

        gameMaster.on('kmud.exec', evt => {
            if (evt.client === self) {
                body = evt.newBody;
                $storage = evt.newStorage;
            }
        });

        client.on('kmud', data => {
            switch (data.eventType) {
                case 'consoleInput':
                    var t0 = new Date().getTime();
                    try {
                        return dispatchInput.call(this, data.eventData);
                    }
                    finally {
                        var te = new Date().getTime() - t0;
                        logger.log(`Command took ${te} ms to execute.`);
                    }

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

    close(reason) {
        this.eventSend({
            eventType: 'kmud.disconnect',
            eventData: reason || '[No Reason Given]'
        });
        this.client.emit('console.disconnect');
        this.client.disconnect();
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
        var prompt = Object.extend({
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
        this.inputStack.push(frame);
        return this.renderPrompt(frame.data);
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

    eventSend(data) {
        if (typeof data.eventType !== 'string')
            throw new Error('Invalid MUD event: ' + JSON.stringify(data));
        this.client.emit('kmud', data);
    }

    registerCallback(name, callback) {
        this[_callbacks][name] = callback;
    }

    renderPrompt(prompt) {
        this.eventSend({
            eventType: 'renderPrompt',
            eventData: prompt
        });
        return this;
    }

    write(text, opts) {
        var data = Object.extend({
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
        return this.eventSend(Object.extend({
            eventType: 'consoleHtml',
            eventData: html
        }, opts)), this;
    }

    writeLine(text) {
        return this.write(text);
    }
}

module.exports = HTTPClientInstance;