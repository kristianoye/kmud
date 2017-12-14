/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const
    Telnet = require('telnet'),
    ClientInstance = require('./ClientInstance'),
    _client = Symbol('_client'),
    tripwire = false; // require('tripwire');

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

class TelnetClientInstance extends ClientInstance {
    constructor(endpoint, gameMaster, client) {
        super(endpoint, gameMaster, client, client.remoteAddress);
        var self = this, clientHeight = 24, clientWidth = 80;

        client.do.window_size();

        client.on('window size', function (e) {
            if (e.command === 'sb') {
                clientHeight = e.height;
                clientWidth = e.width;
            }
        });

        this[_client] = client;

        var T = this, lineBuffer = [], s;

        function dispatchInput(text) {
            var body = T.body();

            gameMaster.setThisPlayer(body);

            if (tripwire) {
                tripwire.resetTripwire(2000, {
                    player: body,
                    input: resp
                });
            }

            text = text.replace(/[\r\n]+/g, '');

            if (T.inputStack.length > 0) {
                var frame = T.inputStack.pop(), result;
                try {
                    result = frame.callback.call(body, text);
                }
                catch (_err) {
                    self.writeLine('Error: ' + _err);
                    self.writeLine(_err.stack);
                    result = true;
                }

                if (result === true) {
                    T.inputStack.push(frame);
                    T.write(frame.data.text);
                }
            }
            else if (body) {
                body.dispatchInput(text);
            }
        }

        this.client.on('data', function (b) {
            if (b.length === 1) {
                switch (b[0]) {
                    case 8:
                        lineBuffer.pop();
                        break;

                    case 13:
                        {
                            dispatchInput(new Buffer(lineBuffer).toString('ascii'));
                            lineBuffer.length = 0;
                        }
                        break;

                    default:
                        lineBuffer.push(b[0]);
                        break;
                }
            }
            else if (b.length === 2 && (b[0] === 13 && b[1] === 10)) {
                dispatchInput(new Buffer(lineBuffer).toString('ascii'));
                lineBuffer.length = 0;
            }
            else {
                dispatchInput(new Buffer(b).toString('ascii'));
            }
        }).on('close', function () {
            T.emit('kmud.connection.closed', T, 'telnet');
            T.emit('disconnected', T);
        });

        this.client.on('window size', function (e) {
            console.log(e);
        });

        Object.defineProperties(this, {
            height: {
                get: function () { return clientHeight; }
            },
            width: {
                get: function () { return clientWidth;  }
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
        this.write(frame.data.text);
        this.inputStack.push(frame);
        return this;
    }

    expandColors(s) {
        var lookup = TERMINALCOLOR['ansi'], c = s.indexOf('%^'), d = 0;

        while (c > -1 && c < s.length) {
            var l = s.indexOf('%^', c+2);
            if (l > -1) {
                var org = s.substr(c + 2, l - c - 2), m = org.toUpperCase(),
                    r = lookup[m];
                // Increment or decrement RESET stack to determine 
                // how many resets to add to end
                d += m === 'RESET' ? -1 : (r ? 1 : 0);
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
            .replace(/<[^>]+>/g, ''))
    }

    writeLine(text) {
        var client = this.client;
        client.write(this.expandColors(text) + '\n');
    }
}

module.exports = TelnetClientInstance;