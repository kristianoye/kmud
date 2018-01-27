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
    GameServer = require('../GameServer'),
    MXC = require('../MXC');

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
class ClientInstance extends EventEmitter {
    /**
     * 
     * @param {ClientEndpoint} endpoint
     * @param {any} _client
     * @param {string} _remoteAddress
     */
    constructor(endpoint, _client, _remoteAddress) {
        super();
        var self = this;

        this.body = null;
        this.client = _client;
        this.caps = new ClientCaps(this);
        this.commandStack = [];
        this.commandTimer = false;
        this.context = MXC.init();
        this.endpoint = endpoint;
        this.inputStack = [];
        this.lastCommand = new Date();
        this.remoteAddress = _remoteAddress;
        this.$storage = false;

        this.client.on('terminal type', ttype => {
            self.emit('terminal type', ttype);
        });

        this.client.on('window size', spec => {
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
     * Called when execution of the current command is complete.  This will
     * release the current context and re-draw the user prompt.
     * @param {number} nextAction What should the command event handler do next.
     * @param {MUDInputEvent} evt The event that is now finished.
     */
    commandComplete(nextAction, evt) {
        this.releaseContext();
        if (this.inputStack.length === 0) {
            this.displayPrompt(evt);
        }
        return nextAction;
    }

    /**
     * Parse a line of user input into words, a verb, etc.
     * @param {string} input The command text entered by the user.
     * @returns {MUDInputEvent} The input event.
     */
    createCommandEvent(input) {
        let words = input.trim().split(/\s+/g),
            verb = words.shift(), self = this;
        let evt = {
            args: words,
            callback: () => { },
            caps: this.caps.queryCaps(),
            client: this,
            complete: function () { },
            error: DefaultError.replace('$verb', verb),
            fromHistory: false,
            input: input.slice(verb.length).trim(),
            original: input,
            prompt: {
                type: 'text',
                text: this.defaultPrompt,
                recapture: false
            },
            verb: verb.trim(),
        };

        evt.complete = (eventResult) => {
            this.commandComplete(eventResult, evt);
            return eventResult || 0;
        };

        return evt;
    }

    /**
     * Initialize
     * @param {MUDInputEvent} cmdEvent The command to be executed.
     */
    createContext(cmdEvent) {
        if (this.context !== false && !this.context.released)
            throw new Error(`Client may not have multiple active contexts!`);

        this.context = driver.getContext(true, mxc => {
            mxc.alarm = maxCommandExecutionTime ? new Date().getTime() + maxCommandExecutionTime : Number.MAX_SAFE_INTEGER;
            mxc.client = this;
            mxc.input = cmdEvent;
            mxc.note = 'executeCommand';
            mxc.$storage = this.$storage;
            mxc.thisPlayer = mxc.truePlayer = this.body();

            mxc.addFrame({
                file: this.body().filename,
                func: 'executeCommand',
                object: this.body()
            });
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
     * Dispatch commands from the command stack in the order received.
     * @param {any} flag
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
        let body = this.body(),
            cmdEvent = this.createCommandEvent(text || '');
        this.lastCommand = new Date();
        driver.setThisPlayer(body, true, cmdEvent.verb);
        this.createContext(cmdEvent);

        try {
            this.context.restore();
            text = text.replace(/[\r\n]+/g, '');
            if (this.inputStack.length > 0) {
                var frame = this.inputStack.pop(), result;
                try {
                    if (!this.client.echoing) {
                        this.write('\r\n');
                        this.client.toggleEcho(true);
                    }
                    result = frame.callback.call(body, text, cmdEvent);
                }
                catch (_err) {
                    this.writeLine('Error: ' + _err);
                    this.writeLine(_err.stack);
                    result = true;
                }
                finally {
                    this.releaseContext();
                }

                if (result === true) {
                    this.inputStack.unshift(frame);
                }
            }
            else if (body) {
                this.$storage && this.$storage.emit('kmud.command', cmdEvent);
            }
        }
        catch (ex) {
            driver.errorHandler(ex, false);
            cmdEvent.complete();
        }
    }

    get idleTime() {
        return new Date().getTime() - this.lastCommand.getTime();
    }

    /**
     * Handle an exec event.
     * @param {any} evt
     */
    handleExec(evt) {
        this.removeAllListeners('disconnected');
        this.$storage = driver.storage.get(this.body = evt.newBody);
        driver.addPlayer(this.body);
        driver.removePlayer(evt.oldBody);
        driver.setThisPlayer(this.body, true, '');
        this.inputStack = [];

        if (!this.context) {
            this.createContext({
                args: [],
                original: '',
                fromHistory: false,
                complete: function () { },
                verb: ''
            });
        }
        this.context.restore();
        this.$storage.emit('kmud.exec', evt);
        this.$storage.setClient(this);
        this.releaseContext();
    }

    releaseContext() {
        if (this.context) {
            this.context.release();
            //if (this.context.refCount !== 0)
            //    logger.log(`WARNING: Context [${this.context.contextId}] refCount was ${this.context.refCount}`);
            this.context = false;
        }
        else {
            logger.log(`WARNING: Context was released too early!`);
        }
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