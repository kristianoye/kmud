/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const
    EventEmitter = require('events'),
    ClientEndpoint = require('./ClientEndpoint');

const
    _body = Symbol('body'),
    _endpoint = Symbol('endpoint'),
    _inputstack = Symbol('_inputstack'),
    _remoteAddress = Symbol('_remoteAddress');

var
    gameMaster;

/**
 * Abstracted client interface shared by all client connection types.
 */
class ClientInstance extends EventEmitter {
    constructor(endpoint, _gameMaster, _client, _remoteAddress) {
        super();
        var _body = null,
            _inputStack = [],
            self = this;

        gameMaster = _gameMaster;

        this[_endpoint] = endpoint;
        this[_inputstack] = [];

        Object.defineProperties(this, {
            body: {
                get: function () { return _body; }
            },
            client: {
                get: function () { return _client; }
            },
            endpoint: {
                get: function () { return _endpoint; }
            },
            inputStack: {
                get: function () { return _inputStack; }
            },
            remoteAddress: {
                get: function () { return _remoteAddress; }
            }
        });

        function handleExec(evt) {
            this.removeAllListeners('disconnected');

            _body = evt.newBody;

            gameMaster.addPlayer(_body);
            gameMaster.removePlayer(evt.oldBody);
            gameMaster.setThisPlayer(_body);

            _inputStack = [];
        }

        gameMaster.on('kmud.exec', evt => {
            if (evt.client === self) {
                handleExec.call(self, evt);
            }
        });
    }

    /**
     * Prompts the user for input
     * @param {Object} opts Options to include in the prompt request.
     * @param {String} opts.type The type of prompt.  May be 'text' or 'password'.
     * @param {String} opts.text The text to display to the user when prompting.
     * @param {Function} callback A function that catches the user's input.
     * @returns {ClientInstance} A reference to the client interface.
     */
    addPrompt(opts, callback) {
        return this;
    }

    /**
     * Parse a line of user input into words, a verb, etc.
     * @param {string} input
     */
    createCommandEvent(input, isBrowser, callback, defaultPrompt) {
        let words = input.trim().split(/\s+/g),
            verb = words.shift();

        return {
            verb: verb.trim(),
            args: words,
            client: this,
            error: 'What?',
            input: input.slice(verb.length).trim(),
            browser: isBrowser,
            prompt: {
                type: 'text',
                text: defaultPrompt,
                recapture: false
            },
            original: input,
            callback: callback,
            fromHistory: false
        };
    }

    /**
     * @returns {string} The remote address of the client.
     */
    get remoteAddress() {
        return this[_remoteAddress];
    }

    /**
     * Associate a body with the connection.
     * @param {MUDObject} body The body that will interpret and dispatch commands from the client.
     * @param {Function} cb The callback that executes once the body association is made.
     * @returns {ClientInstance} A reference to itself.
     */
    setBody(body, cb) {
    }
}

module.exports = ClientInstance;