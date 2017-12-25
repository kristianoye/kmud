/**
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

function ANSI(c) {
    var s = c.toString(), r = [27, 91];

    for (var i = 0; i < s.length; i++) {
        r.push(s.charCodeAt(i));
    }
    r.push(109);
    return new Buffer(new Uint8Array(r)).toString('utf8');
}

function ESC(c) {
    var s = c.toString(), r = [27];

    for (var i = 0; i < s.length; i++) {
        r.push(s.charCodeAt(i));
    }
    return new Buffer(new Uint8Array(r)).toString('utf8');
}

const TERMINALCOLOR = {
    'unknown': {
        'RESET': '',
        'BOLD': '',
        'BLACK': '',
        'RED': '',
        'BLUE': '',
        'CYAN': '',
        'MAGENTA': '',
        'ORANGE': '',
        'YELLOW': '',
        'GREEN': '',
        'WHITE': ''
    },
    'ansi': {
        'RESET': ANSI(0),
        'BOLD': ANSI(1),
        'BLACK': ANSI(30),
        'RED': ANSI(31),
        'BLUE': ANSI(34),
        'CYAN': ANSI(36),
        'MAGENTA': ANSI(35),
        'ORANGE': ANSI(33),
        'YELLOW': ANSI(1) + ANSI(33),
        'GREEN': ANSI(32),
        'WHITE': ANSI(37),
        'INITTERM': ESC("[H") + ESC("[2J")
    },
    'xterm': {
        'RESET': ANSI(0),
        'BOLD': ANSI(1),
        'BLACK': ANSI(30),
        'RED': ANSI(31),
        'BLUE': ANSI(34),
        'CYAN': ANSI(36),
        'MAGENTA': ANSI(35),
        'ORANGE': ANSI(33),
        'YELLOW': ANSI(1) + ANSI(33),
        'GREEN': ANSI(32),
        'WHITE': ANSI(37)
    }
};

class RanvierTelnetInstance extends ClientInstance {
    constructor(endpoint, gameMaster, client) {
        super(endpoint, gameMaster, client, client.remoteAddress);
        var self = this,
            clientHeight = 24,
            clientWidth = 80,
            $storage,
            body;

        this[_client] = client;

        function commandComplete(evt) {
            if (!evt.prompt.recapture)
                self.write(evt.prompt.text);
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

        this.client.on('window size', (spec) => {
            clientWidth = spec.width;
            clientHeight = spec.height;
            if ($storage) {
                $storage.setProperty('clientHeight', clientHeight);
                $storage.setProperty('clientWidth', clientWidth);
            }
        });

        Object.defineProperties(this, {
            height: {
                get: function () { return clientHeight; }
            },
            width: {
                get: function () { return clientWidth; }
            }
        });
    }

    /**
     * @returns {Telnet.Socket} Returns an instance of the underlying socket.
     */
    get client() { return this[_client]; }

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

    expandColors(s) {
        var lookup = TERMINALCOLOR['ansi'], c = s.indexOf('%^'), d = 0;

        while (c > -1 && c < s.length) {
            var l = s.indexOf('%^', c + 2);
            if (l > -1) {
                var org = s.substr(c + 2, l - c - 2), m = org.toUpperCase(),
                    r = lookup[m];
                // Increment or decrement RESET stack to determine 
                // how many resets to add to end
                d += m === 'RESET' ? -1 : r ? 1 : 0;
                r = r || org;
                s = s.substr(0, c) + r + s.substr(l + 2);
                c = s.indexOf('%^', c + r.length);
            }
            else {
                c = s.indexOf('%^', c + 2);
            }
        }
        while (d-- > 0) {
            s += lookup['RESET'];
        }
        return s;
    }

    setBody(body, cb) {
        return super.setBody(body, cb);
    }


    write(text) {
        var client = this.client;
        var active = !(this['__closed__'] || false);
        if (active) client.write(this.expandColors(text));
    }

    writeHtml(html) {
        // TODO: This could probably be improved at some point...
        this.writeLine(html
            .replace(/<br[\/]{0,1}>/ig, '\\n')
            .replace(/<[^>]+>/g, ''));
    }

    writeLine(text) {
        var client = this.client;
        client.write(this.expandColors(text) + '\n');
    }
}

module.exports = RanvierTelnetInstance;