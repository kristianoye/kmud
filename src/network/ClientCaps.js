﻿/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: December 25, 2017
 *
 * Describes what features the client is capable of supporting.
 * Caps stores a collection of defined interfaces and implementation methods.
 */
const
    ClientImplementation = require('./impl/ClientImplementation'),
    events = require('events'),
    DefaultCaps = Object.freeze({
        clientHeight: 24,
        clientWidth: 80,
        colorEnabled: false,
        htmlEnabled: false,
        soundEnabled: false,
        terminalType: 'ascii',
        videoEnabled: false
    });


class ClientCaps extends events.EventEmitter {
    constructor(clientInstance) {
        super();
        let flags = {},
            client = clientInstance,
            interfaces = [],
            methods = {},
            terminalType = false,
            terminalTypes = [],
            height = 24,
            width = 80;

        let setTerminalType = (term) => {
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
                    ClientImplementation.create(this, flags, methods, interfaces);
                }
                catch (err) {
                    logger.log('Could not create client implementation:', err);
                }
            }
        };

        if (client) {
            client.on('kmud', event => {
                switch (event.type) {
                    case 'terminalType':
                        if (event.data) {
                            let ttype = event.data;
                            let tty = ttype.toLowerCase(),
                                n = terminalTypes.indexOf(tty);
                            if (n === -1) terminalTypes.push(tty);

                            setTerminalType(tty);

                            this.emit('kmud', {
                                type: 'terminalType',
                                data: tty
                            });
                        }
                        break;

                    case 'windowSize':
                        {
                            let term = event.data;

                            height = term.height;
                            width = term.width;

                            this.emit('kmud', {
                                type: 'windowSize',
                                data: term
                            });
                        }
                        break;
                }
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
                    return Object.assign({}, flags);
                }
            },
            getMethod: {
                value: function (method) {
                    return methods[method] || false;
                },
                writable: false
            },
            interfaces: {
                get: function () { return interfaces; }
            },
            terminalType: {
                get: function () { return terminalType; }
            }
        });

        setTerminalType(client.defaultTerminalType);
    }

    /**
     * Call a feature implementation.
     * @param {string} method The feature method to invoke.
     * @param {...any[]} args THe arguments to apply to the implementation call.
     * @returns {boolean} True if the method is implemented and the function performed.
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
        let iflist = this.interfaces.slice(0),
            result = {
                clientHeight: this.clientHeight,
                clientWidth: this.clientWidth,
                flags: Object.assign({}, this.flags),
                interfaces: iflist,
                terminalType: this.terminalType
            };

        return result;
    }

    static get DefaultCaps() {
        return DefaultCaps;
    }
}

module.exports = ClientCaps;
