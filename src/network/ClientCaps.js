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
    MudExitsImplementation = require('./impl/MudExitsImplementation'),
    MudHtmlImplementation = require('./impl/MudHtmlImplementation'),
    MudSoundImplementation = require('./impl/MudSoundImplementation'),
    MudVideoImplementation = require('./impl/MudVideoImplementation');


class ClientCaps {
    constructor(clientInstance) {
        let
            self = this,
            flags = {
            },
            client = clientInstance,
            methods = {},
            terminalType = false,
            terminalTypes = [],
            height = 24,
            width = 80;

        function setTerminalType(term) {
            let newTerm = term.toLowerCase();
            if (newTerm !== terminalType) {
                let list = [];

                terminalType = newTerm;
                flags = { color: false, html: false, sound: false, video: false };
                methods = {};
                ClientImplementation.create(self, flags, methods);
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
            client: {
                get: function () { return client; }
            },
            clientHeight: {
                get: function () { return height; }
            },
            clientWidth: {
                get: function () { return width; }
            },
            colorEnabled: {
                get: function () { return flags.colorEnabled; }
            },
            flags: {
                get: function () {
                    let result = {};
                    Object.keys(flags).forEach(k => result[k] = flags[k]);
                    return result;
                }
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

    canDo(name) {
        return this.flags[`${name}Enabled`] === true;
    }

    /**
     * Call a feature implementation.
     * @param {string} name The feature name.
     * @param {string} method The feature method to invoke.
     * @param {...any[]} args THe arguments to apply to the implementation call.
     */
    do(name, method, ...args) {
        let feature = this[name];
        if (feature) {
            return feature[method].apply(this, args);
        }
        return false;
    }

    queryCaps() {
        return this.flags;
    }
}

module.exports = ClientCaps;
