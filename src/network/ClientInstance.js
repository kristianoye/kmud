/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const
    EventEmitter = require('events'),
    ClientEndpoint = require('./ClientEndpoint'),
    ClientCaps = require('./ClientCaps'),
    MUDEventEmitter = require('../MUDEventEmitter'),
    MUDConfig = require('../MUDConfig'),
    GameServer = require('../GameServer');

const
    MudColorImplementation = require('./impl/MudColorImplementation'),
    MudSoundImplementation = require('./impl/MudSoundImplementation'),
    MudVideoImplementation = require('./impl/MudVideoImplementation');

const
    _body = Symbol('body'),
    _endpoint = Symbol('endpoint'),
    _inputstack = Symbol('_inputstack'),
    _remoteAddress = Symbol('_remoteAddress');

var
    DefaultError = 'What?',
    gameMaster;

/**
 * Abstracted client interface shared by all client connection types.
 */
class ClientInstance extends EventEmitter {
    /**
     * 
     * @param {ClientEndpoint} endpoint
     * @param {GameServer} _gameMaster
     * @param {any} _client
     * @param {string} _remoteAddress
     */
    constructor(endpoint, _gameMaster, _client, _remoteAddress) {
        super();
        var _body = null,
            _inputStack = [],
            self = this;

        gameMaster = _gameMaster;

        this.client = _client;
        this.caps = new ClientCaps(this);
        this.endpoint = endpoint;
        this.inputStack = [];
        this.remoteAddress = _remoteAddress;

        Object.defineProperties(this, {
            body: {
                get: function () { return _body; }
            }
        });

        function handleExec(evt) {
            this.removeAllListeners('disconnected');

            _body = evt.newBody;

            gameMaster.addPlayer(_body);
            gameMaster.removePlayer(evt.oldBody);
            gameMaster.setThisPlayer(_body, true, '');

            _inputStack = [];
        }

        gameMaster.on('kmud.exec', evt => {
            if (evt.client === self) {
                handleExec.call(self, evt);
            }
        });

        this.client.on('terminal type', (ttype) => {
            self.emit('terminal type', ttype);
        });

        this.client.on('window size', (spec) => {
            self.emit('window size', spec);
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
    createCommandEvent(input, callback, defaultPrompt) {
        let words = input.trim().split(/\s+/g),
            verb = words.shift(), self = this;
        let evt = {
            args: words,
            callback: callback,
            caps: this.caps.queryCaps(),
            client: this,
            complete: function () { },
            error: DefaultError.replace('$verb', verb),
            fromHistory: false,
            input: input.slice(verb.length).trim(),
            original: input,
            prompt: {
                type: 'text',
                text: defaultPrompt,
                recapture: false
            },
            verb: verb.trim(),
        };

        evt.complete = function (eventResult) {
            callback.call(self, evt);
            return eventResult || 0;
        };

        return evt;
    }

    /**
     * @returns {string}
     */
    get defaultTerminalType() { return 'unknown'; }

    /**
     * Associate a body with the connection.
     * @param {MUDObject} body The body that will interpret and dispatch commands from the client.
     * @param {Function} cb The callback that executes once the body association is made.
     * @returns {ClientInstance} A reference to itself.
     */
    setBody(body, cb) {
    }
}

/**
 * Initializes the client with runtime configuration data.
 * @param {GameServer} driver
 */
ClientInstance.configureForRuntime = function(driver) {
    DefaultError = driver.config.mudlib.defaultError || 'What?';
    gameMaster = driver;
};

module.exports = ClientInstance;