/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const
    ClientEndpoint = require('./ClientEndpoint'),
    ClientComponent = require('../ClientComponent'),
    MUDEventEmitter = require('../MUDEventEmitter'),
    BaseInput = require('../inputs/BaseInput'),
    CommandShell = require('../CommandShell');

var
    maxCommandExecutionTime = 0;

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

        /** @type {ClientComponent[]} */
        this.components = [];
        this.endpoint = endpoint;
        this.inputStack = [];
        this.port = endpoint.port;
        this.remoteAddress = remoteAddress;
        this.storage = false;
    }

    /**
     * Add a component to the client
     * @param {ClientComponent} comp The component to add
     * @returns {boolean} True on success
     */
    addComponent(comp) {
        let indexId = this.components.push(comp);
        return indexId > 0;
    }

    /**
     * Prompts the user for input
     * @param {Object.<string,any>} opts Options to include in the prompt request.
     * @param {string} opts.type The type of prompt.  May be 'text' or 'password'.
     * @param {string} opts.text The text to display to the user when prompting.
     * @param {function(string):void} callback A function that catches the user's input.
     * @returns {ClientInstance} A reference to the client interface.
     */
    addPrompt(opts, callback) {
        return this;
    }

    get clientProtocol() { return 'telnet'; }

    get clientType() { return 'text'; }

    close() {

    }

    /**
     * Find a component by ID
     * @param {string} id The UUID of the component to find.
     */
    getComponentById(id) {
        return this.components.find(c => c.id === id);
    }

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
    get defaultTerminalType() { return 'unknown'; }

    /**
     * The client has disconnected
     * @param {string} protocol The client protocol (should be endpoint?)
     * @param {string} msg The reason for the disconnect.
     */
    disconnect() {
        this.emit('kmud.connection.closed', this, this.clientProtocol);
        this.emit('disconnected', this);
        this.close();
    }

    eventSend() {
        throw new Error('Client must implement eventSend()');
    }

    get idleTime() {
        return this.store && this.store.idleTime;
    }

    /**
     * The remote client disconnected unexpectedly
     */
    remoteDisconnect() {
        this.components.forEach(component => {
            try {
                component.remoteDisconnect('Client closed');
            }
            catch (err) {
                logger.log(`Error in DesktopClient.disconnect(): ${err.meessage}`);
            }
        });

        this.disconnect();

        this.emit('kmud', {
            type: 'remoteDisconnect',
            data: 'Remote client went away'
        });
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
                    type: 'connected',
                    target: true,
                    data: driver.efuns.mudName()
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

    static async registerComponent(client, data) {
        try {
            //  If this is a new client, then it will never find existing components...
            let component = client.getComponentById(data.id)
                || ClientComponent.getComponentById(data.id)
                || new ClientComponent(client, data);

            if (component.requiresShell) {
                if (data.attachTo === 'newLogin') {
                    try {
                        let shell = component.attachShell(new CommandShell(component, data.shellOptions));
                        let newLogin = await driver.connect(client.port, client.clientType);

                        if (newLogin) {
                            shell.attachPlayer(newLogin)
                            if (driver.connections.indexOf(component) === -1)
                                driver.connections.push(component);
                        }
                        else
                            throw new Error('Login not available');

                        component.eventSend({ type: 'connected', data: efuns.mudName() });
                    }
                    catch (err) {
                        client.writeLine('Sorry, something is very wrong right now; Please try again later.');
                        client.close('No Login Object Available');
                    }
                }
                else if (data.auth) {
                    let credentials = client.endpoint.decryptAuthToken(data.auth);
                    if (credentials != false) {
                        try {
                            let result = await driver.connect(client.port, client.clientType, credentials);
                            let [user, shellOptions] = Array.isArray(result) ? result : [result, {}];
                            if (user) {
                                let shell = component.attachShell(new CommandShell(component, shellOptions));
                                shell.attachPlayer(user)

                                if (driver.connections.indexOf(component) === -1)
                                    driver.connections.push(component);
                                component.eventSend({ type: 'connected', data: efuns.mudName() });
                            }
                        }
                        catch (err) {
                            client.writeLine('Sorry, something is very wrong right now; Please try again later.');
                            client.close('No Login Object Available');
                            console.log(err);
                        }
                    }
                }
            }


            return component;
        }
        catch (err) {
            console.log(`What just happened? ${ex}`);
        }
    }
}

ClientInstance.configureForRuntime = function(driver) {
    DefaultError = driver.config.mudlib.defaultError || 'What?';

    maxCommandExecutionTime = driver.config.driver.maxCommandExecutionTime;
    maxCommandsPerSecond = driver.config.driver.maxCommandsPerSecond;
    maxCommandStackSize = driver.config.driver.maxCommandStackSize;
};

module.exports = ClientInstance;

