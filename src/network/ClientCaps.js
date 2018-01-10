/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: December 25, 2017
 *
 * Describes what features the client is capable of supporting.
 * Caps stores a collection of defined interfaces and implementation methods.
 */
const
    ClientImplementation = require('./impl/ClientImplementation'),
    MudColorImplementation = require('./impl/MudColorImplementation'),
    MudHtmlImplementation = require('./impl/MudHtmlImplementation'),
    MudRoomImplementation = require('./impl/MudRoomImplementation'),
    MudSoundImplementation = require('./impl/MudSoundImplementation'),
    MudVideoImplementation = require('./impl/MudVideoImplementation'),
    MUDEventEmitter = require('../MUDEventEmitter');


class ClientCaps extends MUDEventEmitter {
    constructor(clientInstance) {
        super();
        let
            self = this,
            flags = { },
            client = clientInstance,
            interfaces = [],
            methods = {},
            terminalType = false,
            terminalTypes = [],
            height = 24,
            width = 80;

        function setTerminalType(term) {
            let newTerm = term.toLowerCase();
            if (newTerm !== terminalType) {
                let list = [];

                interfaces = [];
                methods = {};
                flags = {
                    color: false,
                    html: false,
                    sound: false,
                    video: false
                };
                terminalType = newTerm;

                try {
                    ClientImplementation.create(self, flags, methods, interfaces);
                }
                catch (err) {
                    logger.log('Could not create client implementation:', err);
                }
            }
        }

        if (client) {
            client.on('terminal type', (ttype) => {
                if (ttype.terminalType) {
                    let tty = ttype.terminalType.toLowerCase(),
                        n = terminalTypes.indexOf(tty);
                    if (n === -1) terminalTypes.push(tty);
                    setTerminalType(tty);

                    self.emit('kmud', {
                        eventType: 'terminalType',
                        eventData: tty
                    });
                }
            });
            client.on('window size', (term) => {
                height = term.height;
                width = term.width;

                self.emit('kmud', {
                    eventType: 'windowSize',
                    eventData: term
                });
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
            flags: {
                get: function () {
                    let result = {};
                    Object.keys(flags).forEach(k => result[k] = flags[k]);
                    return result;
                }
            },
            getMethod: {
                value: function(method) {
                    return methods[method] || false;
                },
                writable: false
            },
            interfaces: {
                get: function () { return interfaces; }
            },
            terminalType: {
                get: function () { return terminalType; }
            },
        });

        setTerminalType(client.defaultTerminalType);
    }

    /**
     * Call a feature implementation.
     * @param {string} method The feature method to invoke.
     * @param {...any[]} args THe arguments to apply to the implementation call.
     */
    do(method, ...args) {
        let implementation = this.getMethod(method);
        if (implementation && typeof implementation === 'function')
            return implementation(...args);
        return false;
    }

    /**
     * Determines whether client has implemented a particular interface.
     * @param {string} interfaceName The name of the interface to check for.
     * @returns {boolean} True if the interface is available within the client.
     */
    implements(interfaceName) {
        return this.interfaces.indexOf(interfaceName) > -1;
    }

    queryCaps() {
        let result = {
            clientHeight: this.clientHeight,
            clientWidth: this.clientWidth,
            flags: this.flags,
            interfaces: this.interfaces.slice(0),
            terminalType: this.terminalType
        };
        return result;
    }
}

module.exports = ClientCaps;
