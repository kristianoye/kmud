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
    maxCommandsPerSecond = 0,
    maxCommandStackSize = 0;
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
        this.lastCommand = new Date();
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
     * Called when execution of the current command is complete.  This will
     * release the current context and re-draw the user prompt.
     * @param {number} nextAction What should the command event handler do next.
     * @param {MUDInputEvent} evt The event that is now finished.
     * @returns {number} An enumeration indicating what the client should do next.
     */
    commandComplete(nextAction, evt) {
        if (!evt.finished) {
            evt.finished = true;
        }
        return nextAction;
    }

    /**
     * Parse a line of user input into words, a verb, etc.
     * @param {string} input The command text entered by the user.
     * @returns {MUDInputEvent} The input event.
     */
    createCommandEvent(input) {
        let words = input && input.trim().split(/\s+/g) || [],
            verb = words && words.shift() || '';
        let evt = {
            args: words,
            callback: () => { },
            caps: this.caps.queryCaps(),
            client: this,
            complete: function () { },
            error: DefaultError.replace('$verb', verb),
            fromHistory: false,
            input: input === false ? '' : input.slice(verb.length).trim(),
            original: input || '',
            prompt: input !== false && {
                type: 'text',
                text: this.defaultPrompt,
                recapture: false
            },
            verb: verb.trim()
        };

        evt.complete = (eventResult) => {
            this.commandComplete(eventResult, evt);
            return eventResult || 0;
        };

        return evt;
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

    /**
     * Dispatch commands from the command stack in the order received.
     * @param {boolean} flag A flag indicating the cooldown timer may be ignored.
     * @returns {NodeJS.Timeout} A timeout handle
     */
    dispatchCommands(flag) {
        if (!this.commandTimer || flag) {
            let text = this.commandStack.shift();
            this.executeCommand(text);
            if (this.commandStack.length > 0 && !this.commandTimer)
                return setTimeout(() => this.dispatchCommands(false), 5);
        }
    }

    /**
     * Enqueue a new command which may or may not execute immediately.
     * @param {any} text
     */
    enqueueCommand(text) {
        this.storage && (this.storage.lastActivity = efuns.ticks);
        if (this.commandStack.length > 0) {
            if (!this.commandTimer && maxCommandsPerSecond) {
                this.commandTimer = setInterval(() => {
                    this.dispatchCommands(true);
                    if (this.commandStack.length === 0) {
                        clearInterval(this.commandTimer);
                        this.commandTimer = false;
                    }
                }, Math.floor(1000 / maxCommandsPerSecond));
            }
        }
        if (this.commandStack.length > maxCommandStackSize) {
            this.writeLine('\nYou must pace yourself! (Command ignored)');
            return;
        }
        this.commandStack.push(text);
        setTimeout(() => this.dispatchCommands(false), 5);
    }

    /**
     * Executes a single command
     * @param {string} text The command to execute.
     */
    executeCommand(text) {
        driver.driverCall('executeCommand', ecc => {
            return false;
            this.populateContext(false, ecc);
            unwrap(this.body, body => {
                if (!body) {
                    this.write('You have no body!  Sorry, no ghosts allowed!');
                    return this.disconnect(false, 'You have no body!  Releasing spirit!');
                }
                try {
                    let isEscaped = false;
                    if (text === '!') {
                        if (this.inputStack.length && body.allowInputEscape === true) {
                            text = text.slice(1);
                            isEscaped = true;
                        }
                    }
                    if (this.inputStack.length && isEscaped === false) {
                        return ecc.withPlayer(this.storage, player => {
                            let inputFrame = this.inputStack.shift(),
                                result = false;

                            ecc.on('complete', () => this.renderPrompt());

                            try {
                                text = text.replace(/[\r\n]+/g, '');
                                if (!this.client.echoing) {
                                    this.write(os.EOL);
                                    this.client.toggleEcho(true);
                                }
                                result = inputFrame.callback.call(player, text);
                                if (result && typeof result.catch === 'function') {
                                    result.catch(err => console.log(err));
                                }
                                if (result === true) {
                                    this.inputStack.unshift(inputFrame);
                                }
                            }
                            catch (err) {
                                this.writeLine('Error: ' + err);
                                this.writeLine(err.stack);
                            }
                        });
                    }
                    else {
                        let cmds = [];
                        if (typeof body.processInput === 'function') {
                            try {
                                cmds = body.processInput(text);
                            }
                            catch (err) {
                                this.writeLine('processInput', err.message);
                            }
                        }
                        else {
                            cmds = efuns.input.splitCommand(text);
                        }
                        if (!Array.isArray(cmds))
                            cmds = [cmds];

                        let prev = false, last = {}, startTime = efuns.ticks;

                        //  Execute 
                        let executeCommandTree = (c = false) => {
                            let cmd = c || cmds.shift();

                            // TODO: Get rid of input references
                            cmd.input = cmd.text;

                            // TODO: Get rid of this, too
                            cmd.htmlEnabled = false;

                            setTimeout(() => {
                                driver.driverCall('executeCommandTree', ecc => {
                                    this.populateContext(false, ecc);
                                    cmd.complete = result => {
                                        last = {};

                                        //  PowerShell Light
                                        if (typeof result === 'object') {
                                            // TODO: Bind intermediate object values to the shell
                                            // variables to allow for binding in subsequent commands.
                                            if (result instanceof MUDObject) {

                                            }
                                            else if (efuns.isPOO(result)) {

                                            }
                                            result = true;
                                        }

                                        //  Last command succeeded
                                        if (result === true) {
                                            //  cmd1 | cmd2
                                            if (cmd.redirect) {
                                                prev = prev || cmd;
                                                last = cmd;
                                                executeCommand(cmd.redirect, cmd);
                                            }
                                            //  cmd1 && cmd2 
                                            else if (cmd.and) {
                                                prev = prev || cmd;
                                                executeCommandTree(cmd.and);
                                            }
                                            if (cmds.length > 0)
                                                executeCommandTree();
                                            else {
                                                let te = efuns.ticks - startTime;
                                                console.log(`Command complete [ellapsed: ${te} ms]`);
                                                this.renderPrompt();
                                            }
                                        }
                                        //  Last command failed
                                        else if (prev.or)
                                            executeCommandTree(prev.or);
                                        else {
                                            let te = efuns.ticks - startTime;
                                            console.log(`Command complete [ellapsed: ${te} ms]`);
                                            this.renderPrompt();
                                        }
                                    };
                                    try {
                                        ecc.withPlayer(this.storage, player => {
                                            player.executeCommand(cmd);
                                        });
                                    }
                                    catch (ex) {
                                        setTimeout(cmd.complete(ex), 0);
                                    }
                                });
                            }, 0)
                        };
                        if (cmds.length > 0)
                            return executeCommandTree();
                        else return this.renderPrompt();
                    }
                }
                catch (ex) {
                    driver.errorHandler(ex, false);
                }
                this.renderPrompt();
            });
        });
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