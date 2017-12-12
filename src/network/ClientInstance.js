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
    constructor(endpoint, _gameMaster, remoteAddress) {
        super();

        gameMaster = _gameMaster;

        this[_body] = null;
        this[_endpoint] = endpoint;
        this[_inputstack] = [];
        this[_remoteAddress] = remoteAddress;
    }

    get body() {
        return this[_body];
    }

    /**
     * @returns {ClientEndpoint} The telnet endpoint this client is connected to.
     */
    get endpoint() {
        return this[_endpoint];
    }

    get inputStack() {
        return this[_inputstack] || [];
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
        var oldBody = this[_body];
        this.removeAllListeners('disconnected');
        this[_body] = body;
        gameMaster.unguarded(() => {
            gameMaster.addPlayer(body);
            if (oldBody) gameMaster.removePlayer(oldBody);
            gameMaster.setThisPlayer(body);
            body().setClient(this);
            this.inputStack.splice(0, this.inputStack.length);
            body().connect();
        }, unwrap(body));
        return true;
    }
}

module.exports = ClientInstance;