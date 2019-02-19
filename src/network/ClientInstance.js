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
    { StandardInputStream, StandardOutputStream } = require('./StandardIO'),
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
     * @param {MUDObject} body The user's current body
     * @returns {[MUDObject, ExecutionContext]} The user's body
     */
    initContext(body, skipCallback = false) {
        return unwrap(body, thisPlayer => {
            let ecc = driver.getExecution();

            ecc.alarmTime = maxCommandExecutionTime ?
                efuns.ticks + maxCommandExecutionTime :
                Number.MAX_SAFE_INTEGER;

            ecc.storage = this.storage;
            ecc.truePlayer = thisPlayer;
            ecc.thisPlayer = thisPlayer;
            ecc.thisClient = this;
            ecc.startTime = efuns.ticks;

            try {
                //  TODO: Make these configurable
                ecc.stdin = new StandardInputStream({ encoding: 'utf8' }, '');
                ecc.stderr = new StandardOutputStream({ encoding: 'utf8' });
                ecc.stdout = new StandardOutputStream({ encoding: 'utf8' });
            }
            catch (err) {
                // TODO: Make this fatal for real
                logger.log('FATAL: Could not allocate streams', err.message);
            }

            if (!skipCallback) {
                ecc.on('complete', completed => {
                    let te = efuns.ticks - completed.startTime;
                    console.log(`Command complete [ellapsed: ${te} ms]`);
                    this.renderPrompt();
                });
            }
            return thisPlayer;
        });
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
    disconnect(protocol, msg) {
        this.emit('kmud.connection.closed', this, protocol);
        this.emit('disconnected', this);
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
            unwrap(this.body, body => {
                if (!body) {
                    this.write('You have no body!  Sorry, no ghosts allowed!');
                    return this.disconnect(false, 'You have no body!  Releasing spirit!');
                }
                try {
                    if (this.inputStack.length) {
                        ecc.withPlayer(this.storage, player => {
                            this.initContext(this.body);
                            let inputFrame = this.inputStack.shift(), result;
                            try {
                                text = text.replace(/[\r\n]+/g, '');
                                if (!this.client.echoing) {
                                    this.write('\r\n');
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

                            cmd.stdin = last.stdout || new StandardInputStream({ encoding: 'utf8' }, cmd.text);
                            cmd.stdout = new StandardOutputStream();
                            cmd.stderr = new StandardOutputStream();

                            setTimeout(() => {
                                driver.driverCall('executeCommandTree', ecc => {
                                    this.initContext(body, false);
                                    cmd.complete = result => {
                                        last = {};

                                        //  Last command succeeded
                                        if (result && result instanceof Error === false) {
                                            //  cmd1 | cmd2
                                            if (cmd.redirect) {
                                                prev = prev || cmd;
                                                last = cmd;
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
                        if (cmds.length > 0) executeCommandTree();
                        else this.renderPrompt();
                    }
                }
                catch (ex) {
                    driver.errorHandler(ex, false);
                }
            });
        });
    }

    get idleTime() {
        return this.store && this.store.idleTime;
    }

    renderPrompt() {
        throw new Error('Not implemented');
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