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
    MudColorImplementation = require('./impl/MudColorImplementation'),
    MudSoundImplementation = require('./impl/MudSoundImplementation'),
    MudVideoImplementation = require('./impl/MudVideoImplementation');

class ClientCaps {
    constructor(clientInstance) {
        let
            self = this,
            colorEnabled = true,
            client = clientInstance,
            htmlEnabled = false,
            soundEnabled = false, 
            terminalType = false,
            terminalTypes = [],
            videoEnabled = false,
            height = 24,
            width = 80;

        /** @type {MudColorImplementation} */
        this.color = null;

        /** @type {MudSoundImplementation} */
        this.sound = null;

        /** @type {MudVideoImplementation} */
        this.video = null;

        function setTerminalType(term) {
            let newTerm = term.toLowerCase();
            if (newTerm !== terminalType) {
                terminalType = newTerm;

                client.color = self.color = MudColorImplementation.createImplementation(newTerm);
                client.sound = self.sound = MudSoundImplementation.createImplementation(newTerm);
                client.video = self.video = MudVideoImplementation.createImplementation(newTerm);
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
                get: function () { return colorEnabled; }
            },
            htmlEnabled: {
                get: function () { return htmlEnabled; }
            },
            soundEnabled: {
                get: function () { return soundEnabled; }
            },
            terminalType: {
                get: function () { return terminalType; }
            },
            videoEnabled: {
                get: function () { return videoEnabled; }
            }
        });

        setTerminalType('unknown');
    }
}

module.exports = ClientCaps;
