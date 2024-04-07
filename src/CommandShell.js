const { TokenType } = require('../node_modules/acorn/dist/acorn');

/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 20, 2019
 *
 * Description: Command interpreter for interactive MUD users.
 */
const
    IO = require('./StandardIO'),
    StreamPromises = require('stream/promises'),
    { ExecutionSignaller } = require('./ExecutionContext'),
    { LinkedList } = require('./LinkedList'),
    BaseInput = require('./inputs/BaseInput'),
    { CommandParser, ParsedCommand, TokenTypes, OperatorTypes } = require('./CommandParser'),
    CommandShellOptions = require('./CommandShellOptions'),
    events = require('events'),
    CommandInterval = 5,
    path = require('path');

const
    TT = {
        Array: 'arrayExpression',
        Assignment: 'assignment',
        Boolean: 'boolean',
        Command: 'command',
        CmdSeperator: 'commandSeparator',
        FileExpression: 'fileExpression',
        Indexer: 'memberIndexer',
        LogicalAND: 'andCommand',
        LogicalOR: 'orCommand',
        MemberGet: 'memberGet',
        MemberExpression: 'memberExpression',
        MethodCall: 'methodCall',
        Number: 'number',
        Object: 'objectExpression',
        Operator: 'operator',
        Pipeline: 'pipeline',
        PList: 'parameterList',
        String: 'string',
        Variable: 'variable',
        VariableValue: 'variableValue',
        Word: 'word',
        WS: 'whitespace'
    },
    ValueTypes = [TT.Array, TT.Boolean, TT.Number, TT.Object, TT.String, TT.Word, TT.VariableValue],
    B_TRUE = 'true',
    B_FALSE = 'false';

class CommandShell extends events.EventEmitter {
    /**
     * Construct a new command shell object.
     * @param {ClientComponent} component The component that is bound to this shell.
     * @param {CommandShellOptions} options The options used when parsing commands.
     */
    constructor(component, options) {
        super();

        this.component = component;

        /** @type {CommandShellOptions} */
        this.options = {
            expandAliases: false,
            expandBackticks: false,
            allowPipelining: false,
            allowEnvironment: false,
            allowFileExpressions: false,
            allowLineSpanning: true,
            allowEscaping: false,
            allowFileIO: false,
            allowHistory: false,
            allowObjectShell: false,
            env: {},
            history: [],
            ...options
        };

        this.client = component.client;

        this.stdin = new IO.StandardInputStream({ encoding: 'utf8' }, component, this);
        this.stdout = new IO.StandardOutputStream({ encoding: 'utf8' }, component, this);
        this.stderr = new IO.StandardOutputStream({ encoding: 'utf8' }, component, this);
        this.console = new IO.StandardPassthruStream({ encoding: 'utf8' }, component, this);

        if (this.options.expandAliases) {
            this.aliases = this.options.aliases || [];
            delete this.options.aliases;
        }
        if (this.options.allowEnvironment) {
            this.env = Object.assign({}, this.options.env);
            delete this.options.env;
        }
        if (this.options.allowHistory) {
            this.history = new LinkedList(options.history || []);
        }
        else {
            this.history = new LinkedList([]);
        }

        //  Is there already a command executing?
        this.executing = false;

        //  LIFO stack for modal inputs
        this.inputStack = [];

        /** @type {ExecutionSignaller} */
        this.inputController = false;

        /** @type {BaseInput} */
        this.inputTo = undefined;

        this.shellLevel = 1;

        component.on('remoteDisconnect', () => {
            if (this.storage) {
                this.storage.eventExec(false);
            }
        });

        this.on('addPrompt', async prompt => {
            if (prompt.isAsync) {
                this.inputTo = prompt;
                await this.drawPrompt();
                let userInput = await this.getUserInput();
                await this.processInput(userInput);
        }
            else if (!this.inputController)
                this.startInputLoop();
        });
    }

    /**
     * Adds a prompt to the user's input stack.
     * @param {BaseInput} prompt Info on how to render the prompt.
     * @param {function(string): void} callback A callback to execute once the user enters text.
     */
    addPrompt(prompt) {
        if (prompt instanceof BaseInput === false)
            throw new Error('Illegal call to addPrompt(); Must be a valid input type');
        this.inputStack.unshift(prompt);
        this.emit('addPrompt', prompt);
    }

    /**
     * Attaches this shell to a player.
     * @param {MUDObject} player The in-game object to attach I/O to .
     * @param {number} shellLevel Shell level determines default behavior for command processing.
     * @param {number} snoopLevel Snoop level 0 [actual player], level 1 [observe], level 2 [control], level 3 [lockout]
     * @returns {boolean} True on success.
     */
    attachPlayer(player, shellLevel = 1, snoopLevel = 0) {
        let storage = driver.storage.get(player);

        if (storage) {
            this.shellLevel = shellLevel;
            this.storage = storage;

            switch (snoopLevel) {
                case 0:
                    storage.shell = this;
                    storage.eventExec(this.component);
                    break;

                case 1:
                case 2:
                case 3:
                    throw new Error('Not implemented');
            }

            return true;
        }
        return false;
    }

    /**
     * Destroy the shell and free its contents.
     */
    destroy() {
        try {
            this.stdout && this.stdout.destroy();
            this.stderr && this.stderr.destroy();
            this.stdin && this.stdin.destroy();
            this.console && this.console.destroy();
        }
        catch (err) {
            logger.log(`Error in CommandShell.destroy(): ${err.message}`);
        }
        return false;
    }

    /**
     * Execute a command
     * @param {ParsedCommand} cmd
     */
    async executeCommand(cmd) {
        let result = '';

        while (cmd) {
            let previousCmd = cmd;

            await this.prepareCommand(cmd);

            if (cmd.redirectStdoutTo) {
                cmd.stdout = cmd.redirectStdoutTo;
            }

            result = await this.storage.eventCommand(cmd);
            let success = result === true || result === 0;

            if (cmd.conditional) {
                //  If command succeeded, proceed to execute next
                if (success) {
                    cmd = cmd.conditional;
                }
                else {
                    do {
                        cmd = cmd.conditional || cmd.pipeTarget;
                    }
                    while (cmd);
                    cmd = cmd.alternate || cmd.nextCommand || false;
                }
            }
            else if (cmd.alternate) {
                //  Short circuit if cmd succeeded
                if (success) {
                    do {
                        cmd = cmd.alternate;
                    }
                    while (cmd);
                    cmd = cmd.conditional || cmd.pipeTarget || cmd.nextCommand || false;
                }
            }
            else if (success) {
                if (cmd.alternate) {
                    do {
                        cmd = cmd.alternate;
                    }
                    while (cmd);
                    cmd = cmd.conditional || cmd.pipeTarget || cmd.nextCommand || false;
                }
                else {
                    cmd = cmd.conditional || cmd.nextCommand || cmd.pipeTarget || false;
                }
            }
            else {
                if (cmd.conditional) {
                    do {
                        cmd = cmd.conditional || cmd.pipeTarget;
                    }
                    while (cmd);
                }
                cmd = cmd.alternate || cmd.nextCommand || cmd.pipeTarget || false;
            }

            if (cmd && previousCmd.redirectStdoutTo) {
                cmd.redirectStdoutTo = previousCmd.redirectStdoutTo;
            }
        }
        return true;
    }

    /**
     * Execute commands in a resource file
     * @param {string} filename
     */
    async executeResourceFile(filename) {
        try {
            let fso = await driver.efuns.fs.getFileAsync(filename);
            if (fso.isFile) {
                let fullText = await fso.readFileAsync(),
                    lines = fullText
                        .split('\n')
                        .map(s => s.trim())
                        .filter(s => {
                            if (s.length === 0 || s.charAt(0) === '#')
                                return false;
                            return true;
                        });
                for (const line of lines) {
                    let cp = new CommandParser(line, this),
                        cmd = await cp.parse();
                    if (cmd) {
                        await this.executeCommand(cmd);
                    }
                }
            }
        }
        catch (err) {
            driver.efuns.errorLine(`-kmsh: Error executing ${filename}: ${err}`);
        }
    }

    /**
     * Prepare a command for execution
     * @param {ParsedCommand} cmd
     */
    async prepareCommand(cmd) {
        let finalArgs = [],
            finalText = [],
            options = cmd.options;

        for (const token of cmd.tokens) {
            switch (token.tokenType) {
                case TokenTypes.TOKEN_BACKTICK:
                    if (options.expandBackticks) {
                        let cp = new CommandParser(token.tokenValue, this),
                            btcmd = await cp.parse();

                        let s = new IO.StandardBufferStream();
                        btcmd.redirectStdoutTo = s;

                        await this.executeCommand(btcmd);

                        let line = s.readLine();
                        while (line) {
                            finalArgs.push(line);
                            line = s.readLine();
                        }
                        continue;
                    }
                    break;

                case TokenTypes.TOKEN_NUMERIC:
                    finalText.push(token.tokenValue.toString());
                    break;

                case TokenTypes.TOKEN_OPERATOR:
                    {
                        switch (token.tokenValue) {
                            case OperatorTypes.OP_APPENDOUT:
                            case OperatorTypes.OP_WRITEOUT:
                                {
                                    let filename = driver.efuns.resolvePath(token.fileName, cmd.options.cwd),
                                        fso = await driver.efuns.fs.getObjectAsync(filename);

                                    cmd.stdout = await fso.createWriteStream({ flags: token.tokenValue === OperatorTypes.OP_APPENDOUT ? 'a' : 'w' });

                                    for (let i = token.index; i <= token.fileToken; i++) {
                                        cmd.tokens[i].tokenType = TokenTypes.TOKEN_WHITESPACE;
                                        cmd.tokens[i].source = '';
                                        cmd.tokens[i].tokenValue = '';
                                    }
                                }
                                continue;

                            case OperatorTypes.OP_READSTDIN:
                                {
                                    let filename = driver.efuns.resolvePath(token.fileName, cmd.options.cwd),
                                        fso = await driver.efuns.fs.getObjectAsync(filename),
                                        s = await fso.createReadStream();

                                    if (!cmd.stdin) {
                                        cmd.stdin = new IO.StandardBufferStream();
                                    }

                                    await StreamPromises.pipeline(s, cmd.stdin, { end: false });
                                    await StreamPromises.finished(s);

                                    for (let i = token.index; i <= token.fileToken; i++) {
                                        cmd.tokens[i].tokenType = TokenTypes.TOKEN_WHITESPACE;
                                        cmd.tokens[i].source = '';
                                        cmd.tokens[i].tokenValue = '';
                                    }
                                }
                                continue;
                        }
                    }
                    break;

                case TokenTypes.TOKEN_WHITESPACE:
                    finalText.push(token.tokenValue);
                    continue;
                    break;

                case TokenTypes.TOKEN_STRING:
                case TokenTypes.TOKEN_WORD:
                    //  Expand variables
                    if (options.expandVariables && !token.isLiteral) {
                        const re = /\$(?<name>[a-zA-Z\_]+[a-zA-Z0-9\_]*)/g;
                        let m = re.exec(token.tokenValue), finalValue = '';

                        while (m) {
                            if (token.tokenValue.charAt(m.index - 1) !== '\\') {
                                if (m.groups.name && m.groups.name in cmd.options.variables) {
                                    let val = cmd.expandVariable(m.groups.name);
                                    if (val) {
                                        token.tokenValue = token.tokenValue.slice(0, m.index) + val + token.tokenValue.slice(m.index + m[0].length);
                                        re.lastIndex = m.index + (val.length || val.toString().length);
                                    }
                                }
                            }
                            m = re.exec(token.tokenValue);
                        }
                    }
                    finalText.push(token.tokenValue);
                    if (options.expandFileExpressions && token.tokenType !== TokenTypes.TOKEN_STRING) {
                        let resolvedPath = path.posix.resolve(options.cwd, token.tokenValue);
                        //  Does it look like a globular expression?
                        if (/[\*\?\[\]]+/.test(token.tokenValue)) {
                            let files = await driver.fileManager.queryFileSystemAsync({
                                cwd: options.cwd,
                                expression: resolvedPath,
                                isGlobstar: token.tokenValue.indexOf('**') > -1
                            });
                            let fileNames = files.map(fo => {
                                if (token.tokenValue.charAt(0) === '/')
                                    return fo.fullPath;
                                else
                                    return path.posix.relative(options.cwd.slice(1), fo.fullPath.slice(1));
                            });
                            if (fileNames.length)
                                finalArgs.push(...fileNames);
                            continue;
                        }
                    }
                    break;
            }
            finalArgs.push(token.tokenValue);
        }

        cmd.args = finalArgs.slice(0);

        if (cmd.pipeTarget) {
            cmd.stdout = cmd.pipeTarget.stdin = new IO.StandardBufferStream();
        }

        if (!cmd.text)
            cmd.text = finalText.join('').trim();

        if (typeof cmd.verb !== 'string') {
            throw new Error('-kmsh: Invalid verb');
        }
    }

    /**
     * Expands a shell variable
     * @param {string} key The variable to search for
     * @param {any} defaultValue The default value to use if the variable is not set.
     * @returns {any} The value or default if not found
     */
    expandVariable(key, defaultValue = '') {
        if (this.env) {
            if (key in this.env === false)
                return defaultValue;

            let val = this.env[key];
            if (typeof val === 'function') {
                let result = '';
                try {
                    result = val.apply(this.player) || defaultValue;
                }
                catch (err) {
                    result = `[ERROR:${key}:${err.message}]`;
                }
                return result;
            }
            return val || defaultValue;;
        }
        return defaultValue;
    }

    /**
     * Send an event to the underlying client.
     * @param {any} eventData
     * @param {any} connected
     */
    eventSend(eventData, connected) {
        //  TODO: Add handling of shell-specific events

        if (connected === true) {
            if (this.component)
                return this.component.eventSend(eventData);
        }
        return false;
    }

    /**
     * Flush out the display streams 
     */
    flushAll() {
        this.stdout && this.stdout.flush();
        this.stderr && this.stderr.flush();
    }

    /**
     * 
     * @param {string} verb
     * @param {CommandShellOptions} opts
     * @returns {CommandShellOptions}
     */
    async getShellSettings(verb, opts = {}) {
        if (this.storage) {
            return await this.storage.getShellSettings(verb, opts);
        }
        return {};
    }

    /**
     * Let the mudlib handle the error
     * @param {string|Error} err The error that occurred
     */
    handleError(err) {
        try {
            return driver.driverCall('handleError', ecc => {
                let cleanError = driver.cleanError(err);

                if (this.player && typeof this.player.shellError === 'function') {
                    return this.player.shellError(cleanError);
                }
                this.stderr.writeLine(`-kmsh: Error: ${err.message || err}`);
                return cleanError;
            });
        }
        catch(err) {
            logger.log('CRITICAL: Error in handleError!', err);
        }
    }

    #options;

    get options() {
        return this.#options;
    }

    set options(o) {
        this.#options = o;
    }

    /**
     * Returns the unwrapped reference to the player
     */
    get player() {
        return unwrap(this.playerRef);
    }

    /**
     * Process a single line of user input.
     * @param {string} input The user's line of input.
     */
    async processInput(input) {
        if (this.inputTo) {
            let inputTo = this.inputTo;
            //  This should not happen, but just in case the current input dissappears...
            if (!inputTo) {
                this.stderr.writeLine(`-kmsh: WARNING: Input frame dissappeared unexpectedly!`);
                return false;
            }
            if (this.options.allowEscaping && input.charAt(0) === '!') {
                input = input.slice(1);
                return false;
            }
            else {
                //  Allow input control to alter the content per internal logic
                input = inputTo.normalize(input, this.client);
                if (typeof input === 'string') {
                    let ecc = driver.getExecution();

                    if (!ecc)
                        throw new Error('FATAL: Execution stack has gone away!');

                    try {
                        let result;

                        if (driver.efuns.isAsync(inputTo.callback))
                            result = await inputTo.callback(input);
                        else
                            result = inputTo.callback(input);

                        if (result !== true) {
                            //  The modal frame did not recapture the user input
                            let index = this.inputStack.indexOf(inputTo);
                            if (index > -1) {
                                this.inputStack.splice(index, 1);
                            }
                        }
                        else
                            this.inputStack.unshift(inputTo);

                        return true;
                    }
                    catch (err) {
                        this.component.writeLine(efuns.eol + 'A serious error occurred');
                        let cleanError = this.handleError(err);
                        if (cleanError.file) {
                            await driver.logError(cleanError.file, cleanError);
                        }
                    }
                    finally {
                        this.inputTo = this.inputStack[0] || false;
                    }
                    return false;

                }
                else if (input instanceof Error) {
                    driver.efuns.errorLine(efuns.eol + `${input.message}` + efuns.eol + efuns.eol);
                    inputTo.error = input.message;
                }
                return true;
            }
            return;
        }
        try {
            this.options = await this.storage.getShellSettings(false, new CommandShellOptions());
            let cp = new CommandParser(input, this),
                cmd = await cp.parse(),
                hist = cmd && cmd.toHistoryString();

            this.storage.lastActivity = driver.efuns.ticks;

            if (!cmd)
                return true;

            if (Array.isArray(cmd.options.history))
                cmd.options.history.push(hist);

            return await this.executeCommand(cmd);
            //return await this.executeCommands(cmds);
        }
        catch (err) {
            this.handleError(err);
            //this.renderPrompt(false);
        }
    }

    /**
     * Get the default prompt to display if the input stack is empty
     * @returns {string}
     */
    get prompt() {
        return this.expandVariable('PROMPT', '> ');
    }

    /**
     * Receive input from stdin
     * @param {StandardInputStream} stream The STDIN stream
     */
    async receiveInput(stream) {
        try {
            if (!this.executing) {
                let commandBuffer = this.commandBuffer = (this.commandBuffer || '') + stream.readLine();

                let incomplete = efuns.text.endsWithUnescaped(commandBuffer, '|') ||
                    efuns.text.endsWithUnescaped(commandBuffer, '&&') ||
                    commandBuffer.trim().endsWith('\\');

                if (this.options.allowLineSpanning) {
                    if (commandBuffer.endsWith('\\')) {
                        commandBuffer = commandBuffer.slice(0, commandBuffer.lastIndexOf('/'));
                    }
                }
                else
                    incomplete = false;

                if (incomplete) {
                    return await this.drawPrompt('> ');
                }
                else {
                    //this.executing = true;
                    //await this.processInput(commandBuffer);
                    this.emit('receiveInput', commandBuffer);
                    this.commandBuffer = '';
                }
            }
        }
        catch (err) {
            console.log('error reading STDIN', err);
        }
    }

    /**
     * This shell is scheduled to be released/destroyed, but the streams 
     * will live on in a new body... */
    releaseStreams() {
        let result = {
            stdin: IO.InternalBuffer.detach(this.stdin),
            stdout: IO.InternalBuffer.detach(this.stdout),
            stderr: IO.InternalBuffer.detach(this.stderr),
            console: IO.InternalBuffer.detach(this.console)
        };

        this.stdin = this.stdout = this.stderr = this.console = false;

        return result;
    }

    drawPrompt() {
        return new Promise(async (resolve, reject) => {
            let inputTo = this.inputStack.length > 0 && this.inputStack[0],
                rejector = function () { reject('input aborted'); };

            this.inputController.onlyOnce('abort', rejector);

            try {
                if (!inputTo) {
                    let text = await driver.driverCallAsync('drawPrompt', async ecc => {
                        return await ecc.withPlayerAsync(this.storage, async player => {
                            if (typeof player.getCommandPrompt === 'function') {
                                if (driver.efuns.isAsync(player.getCommandPrompt))
                                    return await player.getCommandPrompt();
                                else
                                    return player.getCommandPrompt();
                            }
                            else
                                return false;
                        });
                    });
                    if (false === text) {
                        this.once('addPrompt', prompt => {
                            this.component.renderPrompt(prompt);
                            resolve(prompt)
                        });
                        return;
                    }
                    else {
                        //  This is a normal command shell, not an input frame
                        this.component.renderPrompt({ type: 'text', text, console: true });
                        return resolve(false);
                    }
                }
                this.component.renderPrompt(inputTo);
                return resolve(inputTo);
            }
            finally {
                this.removeListener('abort', rejector);
            }
        });
    }

    abortInputs() {
        this.inputTo = false;
        this.inputStack = [];
        this.inputController.abort('abortInputs');
    }

    async getUserInput() {
        return new Promise((resolve, reject) => {
            let rejector = function () { reject('input aborted'); },
                resolver = function (s) { resolve(s); };

            try {
                this.inputController.onlyOnce('abort', rejector);
                this.once('receiveInput', input => resolver(input));
            }
            catch (err) {
                reject(err);
            }
            finally {
                this.inputController.removeListener('abort', rejector);
                this.removeListener('receiveInput', resolver);
            }
        });
    }

    /**
     * 
     * @returns
     */
    async startInputLoop() {
        if (!this.inputController) {
            this.inputController = new ExecutionSignaller();

            try {
                do {
                    this.flushAll();
                    this.inputTo = await this.drawPrompt();
                    let input = await this.getUserInput();

                    await driver.driverCallAsync('input', async ecc => {
                        await ecc.withPlayerAsync(this.storage, async () => {
                            await this.processInput(input);
                        });
                    });
                }
                while (true);
            }
            catch (err) {
                this.inputController = false;
            }
        }
        return this;
    }

    /**
     * Update settings.
     * @param {CommandShellOptions} options An updaed set of shell options.
     */
    update(options) {
        this.options = Object.assign(this.options, options);
        this.env = this.options.env || {};
    }
}

module.exports = CommandShell;
