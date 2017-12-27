/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: December 25, 2017
 *
 * Describes what features the client is capable of supporting.
 *
 * See related specs for implementation details:
 *   - MXP/MSP: http://www.zuggsoft.com/zmud/mxp.htm
 */
const
    ClientImplementation = require('./impl/ClientImplementation'),
    MudColorImplementation = require('./impl/MudColorImplementation'),
    MudHtmlImplementation = require('./impl/MudHtmlImplementation'),
    MudSoundImplementation = require('./impl/MudSoundImplementation'),
    MudVideoImplementation = require('./impl/MudVideoImplementation');

class ClientCaps {
    constructor(clientInstance) {
        let
            self = this,
            flags = {
                colorEnabled: true,
                htmlEnabled: true,
                soundEnabled: true,
                videoEnabled: true
            },
            client = clientInstance,
            terminalType = false,
            terminalTypes = [],
            height = 24,
            width = 80;

        /** @type {MudColorImplementation} */
        this.color = null;

        /** @type {MudHtmlImplementation} */
        this.html = null;

        /** @type {MudSoundImplementation} */
        this.sound = null;

        /** @type {MudVideoImplementation} */
        this.video = null;

        function setTerminalType(term) {
            let newTerm = term.toLowerCase();
            if (newTerm !== terminalType) {
                let list = [];
                terminalType = newTerm;

                list.push(client.color = self.color = MudColorImplementation.createImplementation(newTerm));
                list.push(client.html = self.html = MudHtmlImplementation.createImplementation(newTerm));
                list.push(client.sound = self.sound = MudSoundImplementation.createImplementation(newTerm));
                list.push(client.video = self.video = MudVideoImplementation.createImplementation(newTerm));

                list.forEach(m => m.updateSupportFlags(flags));
            }
        }

        if (client) {
            client.on('terminal type', (ttype) => {
                if (ttype.terminalType) {
                    let tty = ttype.terminalType.toLowerCase(),
                        n = terminalTypes.indexOf(tty);
                    if (n === -1) terminalTypes.push(tty);
                    setTerminalType(tty);
                }
            });
            client.on('window size', (term) => {
                height = term.height;
                width = term.width;
            });
        }

        Object.defineProperties(this, {
            clientHeight: {
                get: function () { return height; }
            },
            clientWidth: {
                get: function () { return width; }
            },
            colorEnabled: {
                get: function () { return flags.colorEnabled; }
            },
            htmlEnabled: {
                get: function () { return  flags.htmlEnabled; }
            },
            soundEnabled: {
                get: function () { return flags.soundEnabled; }
            },
            terminalType: {
                get: function () { return terminalType; }
            },
            videoEnabled: {
                get: function () { return flags.videoEnabled; }
            }
        });

        setTerminalType(client.defaultTerminalType);
    }
}

module.exports = ClientCaps;
