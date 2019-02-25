﻿/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 20, 2019
 *
 * Description: Command interpreter for interactive MUD users.
 */

/// <reference path="./StandardIO.js" />
const
    IO = require('./StandardIO'),
    { LinkedList } = require('./LinkedList'),
    MUDEventEmitter = require('./MUDEventEmitter'),
    { BaseInput } = require('./inputs/BaseInput'),
    CommandInterval = 5;

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

/**
 * @typedef {Object} ParsedCommand 
 * @property {ParsedCommand} [conditional] The next command to execute if the current command succeeded 
 * @property {ParsedCommand} [alternate] The command to execute if the current command failed 
 * @property {ParsedCommand} [pipeline] The next command to feed into once this command finished 
 * @property {string} verb The name of the command to execute
 * @property {any[]} args The arguments to pass to the command
 * @property {string} original The original, raw text from the user
 * @property {string} text The original text from the user but excluding the verb
 * */

/** 
 * @typedef {Object} CommandShellOptions
 * @property {boolean} [allowAliases=false] Indicates the user can use command/verb aliasing.
 * @property {boolean} [allowChaining=false] Indicates the user can chain multiple commnads together.
 * @property {boolean} [allowEnvironment=false] Indicates the user has environmental variables.
 * @property {boolean} [allowEscaping=false] Indicates the user can escape input of the input stack.
 * @property {boolean} [allowFileExpressions=false] Indicates wildcards are expanded to file matches.
 * @property {boolean} [allowFileIO=false] Indicates the user can perform I/O redirects.
 * @property {boolean} [allowHistory=false] Indicates the shell should track command history
 * @property {boolean} [allowLineSpanning=false] The user can use an escape character to span multiple lines of input.
 * @property {boolean} [allowObjectShell=false] Indicates the advanced object shell functionality is enabled.
 * @property {number} [maxHistorySize=0] The maximum number of history entries to retain. 0 is infinite.
 */
class CommandShell extends MUDEventEmitter {
    /**
     * Construct a new command shell object.
     * @param {any} options
     * @param {any} storage
     */
    constructor(options, storage, streams = false) {
        super();

        /** @type {CommandShellOptions} */
        this.options = Object.assign({
            allowAliases: false,
            allowChaining: false,
            allowEnvironment: false,
            allowFileExpressions: false,
            allowLineSpanning: true,
            allowEscaping: false,
            allowFileIO: false,
            allowHistory: false,
            allowObjectShell: false,
            env: {},
            history: []
        }, options);

        this.storage = storage;
        this.client = storage.client;
        this.playerRef = storage.owner;

        if (streams) {
            IO.InternalBuffer.attach(streams, storage.client, this);
        }

        this.stdin = streams.stdin || new IO.StandardInputStream({ encoding: 'utf8' }, storage.client, this);
        this.stdout = streams.stdout || new IO.StandardOutputStream({ encoding: 'utf8' }, storage.client, this);
        this.stderr = streams.stderr || new IO.StandardOutputStream({ encoding: 'utf8' }, storage.client, this);
        this.console = streams.console || new IO.StandardPassthruStream({ encoding: 'utf8' }, storage.client, this);

        if (this.options.allowAliases) {
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

        //  Is there already a command executing?
        this.executing = false;

        //  LIFO stack for modal inputs
        this.inputStack = [];

        /** @type {BaseInput} */
        this.inputTo = undefined;
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
        this.renderPrompt();
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
     * Expand any history expressions
     * @param {string} source The text to expand
     * @returns {string} The string with any history occurences replaced.
     */
    expandHistory(source) {
        let i = -1,
            m = source.length,
            n = i = source.indexOf('!');

        let take = (f, t) => {
            let ret = '';
            if (f instanceof RegExp) {
                let ret = f.exec(source.slice(i));
                if (Array.isArray(ret)) {
                    i += (ret[1] || ret[0]).length;
                    return ret[1] || ret[0];
                }
                return '';
            }
            else if (typeof f === 'string') {
                let check = source.slice(i, i + f.length);
                if (check !== f) return false;
                i += check.length;
                return check;
            }
            ret = source.slice(f = f || i, t = t || f + 1);
            i = t;
            return ret;
        };

        while (n > -1) {
            let lc = source.charAt(i++ - 1);
            if (lc === '\\') {
                //  This one is escaped, find the next
                n = source.slice(n + 1).indexOf('!');
            }
            else {
                //  Not escaped
                let found = '',
                    start = n,
                    search = '!',
                    index = -1,
                    history = this.history,
                    end = n + 1;

                if (take('!')) found = history[history.max];
                else if (take('%')) found = history.keyword || '';
                else {
                    let contains = take('?'),
                        searchBack = take('-');

                    search = take(/[^\s\:]+/);
                    index = parseInt(search), found = false;

                    if (isNaN(index)) {
                        if (contains)
                            for (let ptr = history.first; !found && ptr; ptr = history.next(ptr)) {
                                let n = ptr.value.indexOf(search)
                                if (n > -1) {
                                    let args = efuns.input.splitArgs(found = ptr.value, true);
                                    for (let x = 0; x < args.length; x++) {
                                        if (args[x].indexOf(search) > -1) {
                                            history.keyword = args[x];
                                            break;
                                        }
                                    }
                                }
                            }
                        else
                            for (let ptr = history.last; !found && ptr; ptr = ptr.prev(ptr)) {
                                if (ptr.value.startsWith(search)) {
                                    found = ptr.value;
                                    break;
                                }
                            }
                    }
                    else if (index > 0) {
                        if (searchBack) {
                            let hist = history.toArray();
                            found = hist[hist.length - index];
                        }
                        else
                            found = history.at(index);
                    }
                }
                if (!found)
                    throw Error(`${search}: event not found`);

                if (take(':')) {
                    let nc = take(), args = found.split(/\s+/);
                    if (nc === '^') found = args[1];
                    else if (nc === '*') found = args.slice(1).join(' ');
                    else if (nc === '$') found = args[args.length - 1];
                    else if (/\d/.test(nc)) {
                        nc += take(/^\d+/);
                        if (take('-')) {
                            let endRange = take(/^\d+/);
                            if (endRange)
                                found = args.slice(parseInt(nc), parseInt(endRange) + 1).join(' ');
                            else
                                found = args.slice(parseInt(nc)).join(' ');
                        }
                        else {
                            let foo = parseInt(nc);
                            if (foo < args.length)
                                found = args[foo];
                            else
                                throw new Error(`:${nc}: bad word specifier`);
                        }
                    }
                    else if (nc === 's' || nc === 'g') {
                        if (semver.lt(process.version, '9.0.0')) {
                            throw new Error('Search and replace is only available in Node v9+');
                        }
                        else if (take('&')) {
                            if (!history.lastReplace)
                                throw new Error(':g&: no previous substitution');
                        }
                        else {
                            if (!take('/'))
                                throw new Error(`Expected symbol / at position ${i}`);

                            let searchFor = take(/^(?<!\\)([^\/]+)/);

                            if (!take('/'))
                                throw new Error(`Expected symbol / at position ${i}`);

                            let replaceWith = take(/^(?<!\\)([^\/]+)/);

                            if (take() !== '/')
                                throw new Error(`Expected symbol / at position ${i}`);

                            let flags = take(/[gimu]+/) || undefined;
                            history.lastReplace = new RegExp(`/${searchFor}/${replaceWith}/`, flags);
                        }
                        found = found.replace(history.lastReplace);
                    }

                    while (take(':')) {
                        nc = take();
                        //  remove trailing path
                        if (nc === 'h') {
                            let n = found.lastIndexOf('/');
                            if (n > -1) found = found.slice(0, n);
                        }
                        else if (nc === 'p') {
                            printOnly = true;
                        }
                        //  remove the suffix
                        else if (nc === 'r') {
                            let n = found.lastIndexOf('.');
                            if (n > -1) found = found.slice(0, n);
                        }
                        //  removing leading path
                        else if (nc === 't') {
                            let n = found.lastIndexOf('/');
                            if (n > -1) found = found.slice(n + 1);
                        }
                        else
                            throw Error(`Unrecognized expression starting at position ${i - 1}`);
                    }
                    arg.end = i;
                }
                source = source.slice(0, start) + found + source.slice(i);
                n = source.indexOf('!', i + found.length);
                m = source.length; 
            }
        }

        return source;
    }

    /**
     * Send the command to the body to be executed (via its storage object)
     * @param {ParsedCommand[]} cmds The command chunks to execute.
     */
    executeCommands(cmds) {
        if (cmds.length) {
            setTimeout(async () => {
                try {
                    let cmd = cmds[0], result, err;
                    if (cmd) {
                        if (cmd.subType === TT.Assignment) {
                            let result;
                            if (typeof cmd.value === 'undefined') {
                                result = cmd.lhs.value in this.env;
                                delete this.env[cmd.lhs.value];
                            }
                            else
                                result = this.env[cmd.lhs.value] = cmd.value, cmds;
                            return this.executeResult(result, cmds);
                        }
                        result = this.storage.executeCommand(cmd);
                        if (efuns.isPromise(result)) {
                            return await result
                                .then(r => this.executeResult(r, cmds))
                                .catch(e => this.executeResult(e, cmds));
                        }
                        return this.executeResult(result, cmds);
                    }
                    else
                        return this.renderPrompt(false);
                }
                catch (err) {
                    this.executeResult(err, cmds);
                }
            }, CommandInterval);
        }
        else {
            return this.renderPrompt(false);
        }
    }

    /**
     * 
     * @param {any} result The result of the last command
     * @param {ParsedCommand[]} cmds The commands that are executing.
     */
    executeResult(result, cmds) {
        try {
            let cmd = cmds.shift(),
                success = result !== false && result instanceof Error === false;

            if (this.env) {
                this.env["?"] = success;
                this.env["??"] = result;
            }

            if (success) {
                if (cmd.pipeline) {
                    cmds.unshift(cmd.pipeline);
                    return setTimeout(() => this.executeCommands(cmds), CommandInterval);
                }
                else if (cmd.conditional) {
                    cmds.unshift(cmd.conditional);
                    return setTimeout(() => this.executeCommands(cmds), CommandInterval);
                }
            }
            else {
                if (cmd.pipeline) {
                    cmds.unshift(cmd.pipeline);
                    return setTimeout(() => this.executeCommands(cmds), CommandInterval);
                }
                else if (cmd.alternate) {
                    cmds.unshift(cmd.alternate);
                    return setTimeout(() => this.executeCommands(cmds), CommandInterval);
                }
                else if (cmd.conditional) {
                    while (cmd = cmd.conditional) {
                        if (cmd.alternate) {
                            cmds.unshift(cmd.alternate);
                            return setTimeout(() => this.executeCommands(cmds), CommandInterval);
                        }
                    }
                }
            }
            return setTimeout(() => this.executeCommands(cmds), CommandInterval);
        }
        catch (err) {
            this.handleError(err);
            if (cmds && cmds.length)
                setTimeout(() => this.executeCommands(cmds), CommandInterval);
            else
                this.renderPrompt();
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
     * Flush out the display streams 
     */
    flushAll() {
        this.stdout && this.stdout.flush();
        this.stderr && this.stderr.flush();
    }

    /**
     * Let the mudlib handle the error
     * @param {string|Error} err The error that occurred
     */
    handleError(err) {
        try {
            if (this.player && typeof this.player.shellError === 'function') {
                if (driver.driverCall('handleError', ecc => {
                    let cleanError = driver.cleanError(err);
                    return this.player.shellError(cleanError);
                })) return; // The mudlib handled the error
            }
            this.stderr.writeLine(`-kmsh: Error: ${err.message || err}`);
        }
        catch(err) {
            logger.log('CRITICAL: Error in handleError!', err);
        }
    }

    /**
     * Returns the unwrapped reference to the player
     */
    get player() {
        return unwrap(this.playerRef);
    }

    /**
     * Process command source
     * TODO: Add support for parsing multiple lines (e.g. a script)
     * @param {string} input The source to process
     */
    process(input) {
        let i = 0,
            commandIndex = 0,
            options = this.options,
            source = input.slice(0),
            m = source.length,
            contexts = [],
            isEscaped = false,
            isString = false,
            inExpr = () => {
                for (let n = 0; n < contexts.length; n++)
                    if (contexts[n].isExpression) return true;
                return false;
            },
            command = false,
            lastCommand = false,
            cmds = [];

        let take = (n = 1, start = false, consume = true) => {
            if (typeof n === 'number') {
                let ret = source.slice(i, i + n);
                if (consume) i += n;
                return ret;
            }
            else if (n instanceof RegExp) {
                let ret = n.exec(source.slice(start || i));
                if (ret) {
                    if (consume) i = (start ? start : i) + ret[0].length ;
                    return ret.length > 1 ? ret : ret[0];
                }
                return false;
            }
            else if (typeof n === 'string') {
                let s = start || i, test = source.slice(s, s + n.length);
                if (test === n) {
                    if (consume) i += n.length;
                    return n;
                }
                return false;
            }
            throw new Error(`Unexpected take() expression: ${typeof n}`);
        };
        let getContext = () => {
            return contexts.length > 0 && contexts[0].type;
        };
        /**
         * 
         * @param {number} [start=false] The position to start reading from
         * @param {string} expect The type of token to expect
         * @returns {{ type: string, subType: string, start: number, end: number, value: any }} The token
         */
        let nextToken = (start = false, expect = false, ignore = []) => {
            let token = { value: '', type: TT.Word, start: i = start || i, end: -1 };
            for (let done= false; !done && i < m; i++) {
                let c = source.charAt(i);

                if (isEscaped) {
                    token.value += c;
                    continue;
                }

                // Built-in ObjectShell commands
                if (!command && options.allowObjectShell) {
                    let cmd = take(/\w+\-\w+/);
                    if (cmd) {
                        switch (cmd.toLowerCase()) {
                            default:
                                logger.log(`Running ${cmd}`);
                                break;
                        }
                    }
                }

                switch (c) {
                    case '\\':
                        isEscaped = true;
                        break;

                    case '"': 
                    case "'":
                        if (isString === c) {
                            let nc = source.charAt(i + 1);
                            isString = false;

                            if (!/[a-zA-Z0-9_]/.test(nc)) {
                                token.end = ++i;
                                done = true;
                                break;
                            }
                        }
                        else if (!isString)
                            isString = c;
                        else if (isString)
                            token.value += c;
                        break;


                    case '*':
                    case '?':
                        if (options.expandFileExpressions) {
                            token.value += c;
                            token.type = TT.FileExpression;
                        }
                        else
                            token.value += c;
                        break;

                    case ';':
                        if (options.allowChaining) {
                            token = { type: TT.Operator, subType: TT.CmdSeperator, start: i, end: ++i };
                            done = true;
                        }
                        else
                            token.value += c;
                        break;

                    case '|':
                        if (options.allowChaining) {
                            if (take('|')) {
                                //  Evaluate previous command to see if it succeeded
                                token = {
                                    type: TT.Operator,
                                    subType: TT.LogicalOR,
                                    value: '||',
                                    start: i - 1,
                                    end: ++i
                                };
                                done = true;
                            }
                            else {
                                token = {
                                    type: TT.Operator,
                                    subType: TT.Pipeline,
                                    value: '|',
                                    start: i,
                                    end: ++i
                                };
                                done = true;
                            }
                        }
                        else
                            token.value += c;
                        break;

                    case '&':
                        if (options.allowChaining) {
                            if (take('&')) {
                                //  Evaluate previous command to see if it succeeded
                                token = {
                                    type: TT.Operator,
                                    subType: TT.LogicalAND,
                                    value: '&&',
                                    start: i - 1,
                                    end: ++i
                                };
                                done = true;
                            }
                        }
                        else
                            token.value += c;
                        break;

                    case '.':
                        if (options.allowObjectShell && inExpr()) {
                            token.isExpression = true;
                            if (!(token.target = contexts.shift()))
                                throw new Error(`Unexpected end of input at position ${i}`);
                            token.member = nextToken(token.end = ++i, TT.Word);
                            token.start = token.target.start;
                            token.type = TT.MemberExpression;

                            contexts.unshift(token);

                            //  Possible branches:
                            //  (1) a method call,
                            //  (2) a property access (get)
                            let next = nextToken();

                            if (next.type === TT.PList) {
                                token.subType = TT.MethodCall;
                                token.args = next;
                                token.end = next.end;

                                let ob = token.target.value;
                                try {
                                    token.value = ob[token.member.value].apply(ob, token.args.value);
                                }
                                catch (err) {
                                    token.value = err;
                                }
                            }
                            else {
                                // rewind the stream
                                if (next) i = next.start;
                                token.subType = TT.MemberGet;
                                token.isExpression = true;
                                
                                let ob = token.target.value;
                                try {
                                    token.value = ob[token.member.value];
                                    if (typeof token.value === 'function')
                                        throw new Error(`Illegal attempt to retrieve function '${token.member.value}' with indexer`);
                                }
                                catch (err) {
                                    token.value = err;
                                }
                            }
                            //  We are done with this expression
                            contexts.shift();
                        }
                        else
                            token.value += c;
                        break;

                    case '=':
                        if (options.allowObjectShell) {
                            if (take('==')) {
                                //  Equality operator
                            }
                            else {
                                token.lhs = contexts.shift();
                                if (!token.lhs || token.lhs.type !== 'variable') {
                                    throw new Error(`Unexpected token '=' at position ${i}`);
                                }
                                contexts.unshift(command = token);
                                token.type = TT.Command;
                                token.subType = TT.Assignment;
                                token.begin = token.lhs.start;
                                token.rhs = nextToken(++i, false, [TT.WS]);
                                if (token.rhs.type === TT.Word) {
                                    let v = token.rhs.value, asNumber = parseFloat(v);
                                    if (!isNaN(asNumber))
                                        token.value = asNumber;
                                    else if (/(true|false)/i.test(v))
                                        token.value = v === 'true';
                                    else
                                        token.value = v;
                                }
                                else
                                    token.value = token.rhs.value;
                                token.end = i;
                                contexts.shift();
                                return token;
                            }
                        }
                        else
                            token.value += c;
                        break;

                    case ',':
                        if (options.allowObjectShell && inExpr()) {
                            token.type = TT.Operator;
                            token.subType = ',';
                            token.value = ',';
                            token.end = ++i;
                            done = true;
                        }
                        else
                            token.value += c;
                        break;

                    case '$':
                        if (options.allowEnvironment && ++i < m) {
                            let expandVariable = true;
                            // Special case variables
                            if (take(/\?{1,2}/)) {
                                let varName = source.slice(token.start, i).slice(1);
                                token.type = TT.VariableValue;
                                token.value = this.env[varName];
                                token.end = i;
                                done = true;
                            }
                            else {
                                let name = nextToken(i, TT.Word);
                                token.type = TT.Variable;
                                token.value = name.value;
                                i = token.end = name.end;

                                if (options.allowObjectShell) {
                                    //  Member expression
                                    if (take('.')) {
                                        token.type = TT.MemberExpression;
                                        contexts.unshift(token); Krit
                                        return nextToken(--i);
                                    }
                                    //  Does it look like variable assignment?
                                    else if (!command && take(/\s*=/, false, false)) {
                                        contexts.push(token);
                                        token = nextToken(false, TT.Assignment, [TT.WS]);
                                        expandVariable = false;
                                        done = true;
                                        break;
                                    }
                                    // Member expansion
                                    else {
                                        token.type = TT.VariableValue;
                                        token.value = this.expandVariable(name.value);
                                    }
                                }
                            }
                            if (expandVariable) {
                                let convertValue = (value) => {
                                    let valueType = typeof value;
                                    if (['number', 'boolean', 'string'].indexOf(valueType) > -1)
                                        return `${value}`;
                                    else if (Array.isArray(value))
                                        return '[ ' + value.map(v => convertValue(v)).join(', ') + ' ] ';
                                    else if (typeof value === 'object') {
                                        let result = '{ ';
                                        Object.keys(value).forEach((key, index) => {
                                            if (index > 0)
                                                result += ', ';
                                            result += convertValue(key);
                                            result += ':';
                                            result += convertValue(value[key]);
                                        });
                                        result += ' }';
                                        return result;
                                    }
                                    else
                                        return valueType.toUpperCase();
                                };
                                let textVersion = convertValue(token.value);
                                source = source.slice(0, token.start) + textVersion + source.slice(token.end);
                                i = token.start + textVersion.length;
                                token.end = token.start + textVersion.length;
                                m = source.length;
                                done = true;
                            }
                        }
                        else
                            token.value += c;
                        break;

                    case '[': // Array expression or indexer
                        if (options.allowObjectShell && inExpr() && getContext() === TT.MemberExpression) {
                            token.type = TT.Indexer;

                            let key = nextToken(++i, TT.Word, [TT.WS]);
                            while (key.type === TT.WS) {
                                key = nextToken();
                            }
                            if (key.type !== TT.Word)
                                throw new Error(`Unexpected token '${key.type}' at position ${i}`);
                            token.value = key;
                            key = nextToken();

                            // Eat whitespace
                            while (key.type === TT.WS) {
                                key = nextToken();
                            }
                            token.end = i;
                            break;
                        }
                        /** intentionally fall through to array scenario */

                    case '(': // Parameter list
                        if (options.allowObjectShell && inExpr()) {
                            token.type = c === '(' ? TT.PList : TT.Array;
                            token.value = c;
                            token.end = ++i;
                            token.args = [];

                            contexts.unshift(token);

                            let endsWith = token.type === TT.PList ? ')' : ']';
                            while (!take(endsWith)) {
                                let next = nextToken(false, false, [TT.WS]);
                                if (!next)
                                    throw new Error(`Unexpected end of ${token.type} at position ${i}`);
                                token.end = next.end;
                                if (next.value === ',') continue;
                                else if (next.type === TT.WS) continue;
                                else if (next.type === TT.Word) {
                                    if (next.value === B_TRUE || next.value === B_FALSE) {
                                        next.value = next.value === B_TRUE;
                                        next.type = TT.Boolean;
                                    }
                                    else {
                                        let val = parseFloat(next.value);
                                        if (!isNaN(val)) {
                                            next.value = val;
                                            next.type = TT.Number;
                                        }
                                        else
                                            next.type = TT.String;
                                    }
                                    token.args.push(next);
                                }
                                else 
                                    token.args.push(next);
                                if (take(endsWith)) break;
                                next = nextToken();
                            }
                            token.end = i;
                            token.text = source.slice(token.start, token.end);
                            token.value = token.args.map(a => a.value);

                            contexts.shift();

                            done = true;
                        }
                        else
                            token.value += c;
                        break;

                    case '{': // Object expression (or function body)
                        if (options.allowObjectShell && inExpr()) {
                            token.type = TT.Object;
                            token.end = ++i;
                            token.value = {};

                            contexts.push(token);

                            while (!take('}')) {
                                key = nextToken();
                                if (!key)
                                    throw new Error(`Unexpected end of ${token.type} at position ${i}`);
                                if (key.type === TT.WS) continue;
                                else if (key.type === TT.Word) {
                                    let val = parseFloat(key.value);
                                    if (!isNaN(val)) {
                                        key.value = val;
                                        key.type = 'number';
                                    }
                                    else
                                        key.type = 'string';
                                }
                                else
                                    throw new Error(`Unexpected token '${key.type}' at position ${i}`);

                                let value = nextToken();
                                while (value.type === TT.WS) {
                                    value = nextToken();
                                }
                                token.value[key.value] = value.value;
                                if (take(endsWith)) break;
                            }
                            token.end = i;
                            token.value = source.slice(token.start, token.end);
                            done = true;
                        }
                        else
                            token.value += c;
                        break;


                    default:
                        if (/\s/.test(c)) {
                            if (token.value) {
                                token.end = i - 1;
                                done = true;
                            }
                            else {
                                token.type = TT.WS;
                                i += (token.value = take(/^\s+/, i)).length;
                                token.end = i;
                                done = true;
                            }
                        }
                        else if (isString) {
                            token.value += c;
                        }
                        else if (/[a-zA-Z0-9_]/.test(c)) {
                            i += (token.value += take(/^[a-zA-Z0-9_]+/, i)).length;
                            token.end = i;

                            if (options.allowObjectShell && take('.')) {
                                if (token.value === 'process') {
                                    token.type = 'object';
                                    token.value = process;
                                    token.isExpression = true;
                                    contexts.unshift(token);
                                    return nextToken(--i, TT.MemberExpression);
                                }
                                else if (token.value === 'me' || token.value === 'myself') {
                                    token.type = 'object';
                                    token.value = this.player;
                                    contexts.unshift(token);
                                    token.isExpression = true;
                                    return nextToken(--i, TT.MemberExpression);
                                }
                                else --i;
                            }
                            done = true;
                        }
                        else if (inExpr())
                            throw new Error(`Unexpected character ${c} at position ${i}`);
                        else
                            token.value += c;
                        break;
                }

                if (done || i + 1 === m) {
                    if (token.end === -1)
                        throw new Error(`Error: Token ${this.type} did not send an end position`);
                    break;
                }
            }
            token.isValueType = ValueTypes.indexOf(token.type) > -1;
            if (ignore.length > 0 && ignore.indexOf(token.type) > -1)
                return nextToken(false, expect, ignore);
            else if (expect) {
                if (Array.isArray(expect) && expect.indexOf(token.type) === -1)
                    throw new Error(`Error: Got token type '${token.type}' but expected '${expect.join(', ')}' at position ${token.start}`);
                if (token.type !== expect) 
                    throw new Error(`Error: Got token type '${token.type}' but expected '${expect}' at position ${token.start}`);
                return token;
            }
            if (!command && token.type === TT.Word) {
                command = {
                    // Flow control
                    conditional: false,
                    alternate: false,
                    then: false,
                    pipeline: false,

                    type: TT.Command,
                    verb: token,
                    index: commandIndex++,
                    start: token.start,
                    end: token.end,
                    args: []
                };
                if (command.index === 0) {
                    let overrides = this.player && driver.driverCall('prepareCommand', () => {
                        try {
                            return this.player.prepareCommand(command.verb);
                        }
                        catch (err) {

                        }
                        return {};
                    });
                    options = Object.assign(options, overrides);
                }
                let arg = nextToken();
                while (arg) {
                    if (arg.isValueType) {
                        command.args.push(arg);
                    }
                    else if (arg.type !== TT.WS) {
                        i = arg.start;
                        break;
                    }
                    arg = nextToken();
                }
                if (arg && arg.type !== TT.Operator)
                    throw new Error(`Unexpected token ${arg.type} found starting at position ${i}`);
                command.source = source.slice(command.start, command.end = i);
                command.text = source.slice(command.verb.end, command.end).trim();
                return command;
            }
            else if (token.type === TT.Operator && !lastCommand && !command)
                throw new Error(`Unexpected operator ${token.value} found at position ${token.start}`);
            else if (token.type === TT.Command)
                return token;
            return !!token.value && token;
        };

        for (; i < m;) {
            let tok = nextToken();

            switch (tok.type) {
                case TT.Command:
                    if (lastCommand)
                        throw new Error(`Unexpected command found starting at position ${i}`);
                    cmds.push(lastCommand = tok);
                    command = false;
                    break;

                case TT.Operator:
                    {
                        let nextCmd = nextToken();
                        while (nextCmd && nextCmd.type !== TT.Command) {
                            nextCmd = nextToken();
                        }
                        if (nextCmd.type !== TT.Command)
                            throw new Error(`Could not find next command expression after ${token.start}`)

                        tok.value = nextCmd;

                        switch (tok.subType) {
                            case TT.CmdSeperator:
                                cmds.push(lastCommand = tok.value);
                                break;

                            case TT.LogicalAND:
                                lastCommand.conditional = tok.value;
                                lastCommand = tok.value;
                                break;

                            case TT.LogicalOR:
                                lastCommand.alternate = tok.value;
                                lastCommand = tok.value;
                                break;

                            case TT.Pipeline:
                                lastCommand.pipeline = tok.value;
                                lastCommand = tok.value;
                                break;

                            default:
                                throw new Error(`Unrecognized command operator `);
                        }
                        command = false;
                    }

                case TT.WS:
                    break;

                default:
                    throw new Error(`Unexpected token: ${tok.type} starting at position ${tok.start}`);
            }
        }

        return cmds;
    }

    /**
     * Process a single line of user input.
     * @param {string} input The user's line of input.
     */
    processInput(input) {
        driver.driverCall('input', ecc => {

            //  Set up for the next command
            ecc.whenCompleted(() => {
                this.inputTo = false;
                !this.executing && this.renderPrompt();
            });

            try {
                if (this.inputTo) {
                    let inputTo = this.inputTo;

                    let inputTrapped = ecc.withPlayer(this.storage, () => {
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

                                ecc = ecc && ecc.fork();
                                if (efuns.isAsyncCallback(inputTo.callback)) {
                                    setTimeout(async () => {
                                        let currentContext = driver.getExecution(), result, error;
                                        try {
                                            if (!currentContext)
                                                ecc.restore();

                                            result = await ecc.withPlayerAsync(this.storage,
                                                async () => {
                                                    return await inputTo.callback(input);
                                                })
                                                .catch(e => { error = e; });

                                            if (error) {
                                                this.stdout.writeLine('\nOops something bad happened.\n\n');

                                                logger.log('processInput error', error);

                                                // Whatever user was doing did not work.  Do not allow
                                                // the previous entry to recapture user input.  Let the
                                                // player body decide what to do.
                                                result = driver.driverCall('applyInputError', ecc => {
                                                    if (this.player && this.player.applyInputError) {
                                                        ecc.restore();
                                                        ecc.withPlayer(this.storage, player => {
                                                            return player.applyInputError(error);
                                                        });
                                                    }
                                                });

                                                if (result === false)
                                                    return;  // Do not recapture... do nothing
                                            }
                                        }
                                        catch (err) {
                                            logger.log('Error in async callback: ', err);
                                        }
                                        finally {
                                            if (result !== true) {
                                                let index = this.inputStack.indexOf(inputTo);
                                                if (index > -1) {
                                                    this.inputStack.splice(index, 1);
                                                }
                                                return this.renderPrompt(this.inputTo = false);
                                            }
                                            else // recapture
                                                this.renderPrompt();
                                        }
                                    }, CommandInterval);
                                    return undefined;
                                }
                                else {
                                    try {
                                        let result = inputTo.callback(input);
                                        if (efuns.isPromise(result)) {
                                            let  ecc = driver.getExecution(), child = ecc.fork(true);
                                            setTimeout(async () => {
                                                try {
                                                    child.whenCompleted(() => {
                                                        this.renderPrompt(this.inputTo = false);
                                                    });
                                                    child.restore();
                                                    child.push(this.player, 'processInput', this.player.filename);
                                                    let foo = await result;
                                                    console.log('async code complete', foo);
                                                }
                                                catch (e) {
                                                    logger.log('error in async processing', e);
                                                }
                                                finally {
                                                    child.pop('processInput');
                                                    child.suspend();
                                                }
                                            }, CommandInterval);
                                            return undefined;
                                        }
                                        if (result !== true) {
                                            //  The modal frame did not recapture the user input
                                            let index = this.inputStack.indexOf(inputTo);
                                            if (index > -1) {
                                                this.inputStack.splice(index, 1);
                                            }
                                        }
                                        return true;
                                    }
                                    catch (err) {
                                        logger.log('error in sync.input.callback', err);
                                    }
                                    return false;
                                }

                            }
                            else if (input instanceof Error) {
                                this.stderr.write(`\n${input.message}\n\n`);
                            }
                            return true;
                        }
                    });

                    if (inputTrapped === true) {
                        this.executing = false;
                        this.flushAll();
                        return true;
                    }
                    else if (typeof inputTrapped === 'undefined') {
                        //  Async call
                        this.flushAll();
                        return true;
                    }
                }
                try {
                    if (this.options.allowHistory) {
                        let newInput = this.expandHistory(input);
                        if (newInput !== input)
                            this.stdout.writeLine(newInput);
                        this.history && this.history.push(newInput);
                        input = newInput;
                    }

                    let cmds = this.process(input);
                    return this.executeCommands(cmds);
                }
                catch (err) {
                    this.handleError(err);
                    this.renderPrompt(false);
                }
            }
            catch (err) {
                efuns.failLine(`CRITICAL: ${err.message}`);
            }
        });
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
    receiveInput(stream) {
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
                    return this.renderPrompt('> ');
                }
                else {
                    this.executing = true;
                    this.processInput(commandBuffer);
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

    /**
     * The actual displaying of the prompt is dependent on the client.
     * The shell just tells the client what to render...
     * @param {BaseInput} [inputTo] The frame to render
     */
    renderPrompt(inputTo) {
        if (inputTo === false) {
            inputTo = undefined;
            this.executing = false;
        }
        setTimeout(() => {
            if (this.storage && this.storage.connected && !this.executing) {
                try {
                    this.flushAll();

                    if (!this.inputTo) {
                        if (!inputTo && this.inputStack.length)
                            inputTo = this.inputTo = this.inputStack[0];

                        else if (typeof inputTo === 'string')
                            throw new Error('Invalid input');

                        if (inputTo) {
                            this.client.renderPrompt(inputTo);
                        }
                        else {
                            this.client.renderPrompt({ type: 'text', text: this.prompt });
                        }
                    }
                }
                catch (err) {
                    this.client && this.client.writeLine(`CRITICAL: ${err.message}`);
                    this.client && this.client.write('> ');
                }
                finally {
                    this.flushAll();
                }
            }
        }, CommandInterval);
    }

    /**
     * Update settings.
     * @param {CommandShellOptions} options An updaed set of shell options.
     */
    update(options) {
        this.options = Object.assign(this.options, options);
        this.env = options.env;
    }
}

module.exports = CommandShell;
