﻿/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const
    Telnet = require('ranvier-telnet'),
    ClientInstance = require('./ClientInstance'),
    MUDData = require('../MUDData'),
    _client = Symbol('_client'),
    tripwire = false;

class RanvierTelnetInstance extends ClientInstance {
    constructor(endpoint, gameMaster, client) {
        super(endpoint, gameMaster, client, client.remoteAddress);
        var self = this,
            clientHeight = 24,
            clientWidth = 80,
            $storage,
            body;

        function commandComplete(evt) {
            if (!evt.prompt.recapture) {
                self.write(evt.prompt.text);
            }
        }

        function dispatchInput(text) {
            let body = this.body(),
                evt = this.createCommandEvent(text, true, commandComplete, '> ');
            try {
                gameMaster.setThisPlayer(body);

                if (tripwire) {
                    tripwire.resetTripwire(2000, {
                        player: body,
                        input: resp
                    });
                }

                text = text.replace(/[\r\n]+/g, '');

                if (this.inputStack.length > 0) {
                    var frame = this.inputStack.pop(), result;
                    try {
                        if (!this.client.echoing) self.client.toggleEcho(true);
                        result = frame.callback.call(body, text);
                    }
                    catch (_err) {
                        this.writeLine('Error: ' + _err);
                        this.writeLine(_err.stack);
                        result = true;
                    }

                    if (result === true) {
                        this.inputStack.push(frame);
                        this.write(frame.data.text);
                    }
                }
                else if (body) {
                    $storage.emit('kmud.command', evt);
                }
            }
            catch (err) {
                if (evt) evt.callback(evt);
                MUDData.MasterObject.errorHandler(err, false);
            }
        }

        gameMaster.on('kmud.exec', evt => {
            if (evt.client === self) {
                body = evt.newBody;
                $storage = evt.newStorage;
            }
        });

        this.client.on('data', (buffer) => {
            dispatchInput.call(this, buffer.toString('utf8'));
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


    write(text) {
        var client = this.client;
        var active = !(this['__closed__'] || false);
        if (active) client.write(this.caps.color.expandColors(text));
    }

    writeHtml(html) {
        this.writeLine(html
            .replace(/<br[\/]{0,1}>/ig, '\\n')
            .replace(/<[^>]+>/g, ''));
    }

    writeLine(text) {
        var client = this.client;
        client.write(this.caps.color.expandColors(text) + '\n');
    }
}

module.exports = RanvierTelnetInstance;