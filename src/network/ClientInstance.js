/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const
    ClientEndpoint = require('./ClientEndpoint'),
    ClientCaps = require('./ClientCaps'),
    MUDEventEmitter = require('../MUDEventEmitter'),
    { BaseInput } = require('../inputs/BaseInput'),
    GameServer = require('../GameServer'),
    os = require('os');

var
    maxCommandExecutionTime = 0,
    DefaultError = 'What?';

/**
 * Abstracted client interface shared by all client connection types.
 */
class ClientInstance extends MUDEventEmitter { // EventEmitter {
    /**
     * 
     * @param {ClientEndpoint} endpoint
     * @param {any} client
     * @param {string} remoteAddress
     */
    constructor(endpoint, client, remoteAddress) {
        super();

        this.body = null;
        this.client = client;
        this.caps = new ClientCaps(this);
        this.commandStack = [];
        this.commandTimer = false;
        this.endpoint = endpoint;
        this.inputStack = [];
        this.port = endpoint.port;
        this.remoteAddress = remoteAddress;
        this.storage = false;

        this.client.on('terminal type', ttype => this.emit('terminal type', ttype));
        this.client.on('window size', spec => this.emit('window size', spec));
    }

    /**
     * Prompts the user for input
     * @param {Object} opts Options to include in the prompt request.
     * @param {String} opts.type The type of prompt.  May be 'text' or 'password'.
     * @param {String} opts.text The text to display to the user when prompting.
     * @param {function(string):void} callback A function that catches the user's input.
     * @returns {ClientInstance} A reference to the client interface.
     */
    addPrompt(opts, callback) {
        return this;
    }

    get clientType() { return 'text'; }

    /**
     * Initialize
     * @param {boolean} skipCallback If true then no onComplete handler is created.
     * @param {ExecutionContext} ecc The current execution context.
     */
    populateContext(skipCallback = false, ecc = false, opts = {}) {
        let thisPlayer = unwrap(this.body);

        ecc = ecc || driver.getExecution();

        ecc.alarmTime = maxCommandExecutionTime ?
            efuns.ticks + maxCommandExecutionTime :
            Number.MAX_SAFE_INTEGER;

        if (ecc.truePlayer && ecc.truePlayer !== thisPlayer)
            throw new Error('FATAL: TruePlayer has already been set!');

        ecc.truePlayer = thisPlayer;
        ecc.player = thisPlayer;
        ecc.client = this;
        ecc.store = this.storage;
        ecc.shell = ecc.client.shell;

        if (skipCallback === false) {
            ecc.on('complete', result => {
            });
        }
    }

    /**
     * The default prompt painted on the client when a command completes.
     * @returns {string}
     */
    get defaultPrompt() {
        return '> ';
    }


    /**
     * @returns {string}
     */
    get defaultTerminalType() {
        return 'unknown';
    }

    /**
     * The client has disconnected
     * @param {string} protocol The client protocol (should be endpoint?)
     * @param {string} msg The reason for the disconnect.
     */
    disconnect(protocol, msg, emitDisconnect = true) {
        this.emit('kmud.connection.closed', this, protocol);
        if (emitDisconnect) this.emit('disconnected', this);
    }

    get idleTime() {
        return this.store && this.store.idleTime;
    }

    renderPrompt(input) {
        if (input instanceof BaseInput) {
            return input.render(this);
        }
        else if (input.type === 'text' || input.type === 'password') {
            this.toggleEcho(input.type !== 'password');
            return this.write(input.text);
        }
        return false;
    }

    setBody(body, oldBodyValue = false) {
        //  Trying to leave a different body? Nope
        if (oldBodyValue && oldBodyValue() !== this.body())
            return false;

        driver.driverCall('setBody', ecc => {
            // Connect to the new body
            return unwrap(body, newBody => {
                let storage = driver.storage.get(newBody);

                storage && storage.setClient(this, this.port, this.clientType);
                this.eventSend({
                    eventType: 'kmud.connected',
                    eventData: driver.efuns.mudName()
                });
                return true;
            });
        });
    }

    toggleEcho(echoOn = true) {
        if (echoOn !== this.echoEnabled) {
            this.echoEnabled = echoOn;
            this.client.toggleEcho(echoOn);
        }
        return this.echoEnabled;
    }
}

/**
 * Initializes the client with runtime configuration data.
 * @param {GameServer} driver
 */
ClientInstance.configureForRuntime = function(driver) {
    DefaultError = driver.config.mudlib.defaultError || 'What?';

    maxCommandExecutionTime = driver.config.driver.maxCommandExecutionTime;
    maxCommandsPerSecond = driver.config.driver.maxCommandsPerSecond;
    maxCommandStackSize = driver.config.driver.maxCommandStackSize;
};

module.exports = ClientInstance;