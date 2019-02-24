/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 20, 2019
 *
 * Description: Command interpreter for MUD objects.
 */

/// <reference path="./StandardIO.js" />
const
    IO = require('./StandardIO'),
    LinkedList = require('./LinkedList'),
    MUDEventEmitter = require('./MUDEventEmitter'),
    { BaseInput } = require('./inputs/BaseInput');

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
    ValueTypes = [ TT.Array, TT.Boolean, TT.Number, TT.Object, TT.String, TT.Word ],
    B_TRUE = 'true',
    B_FALSE = 'false';

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
            allowObjectShell: false
        }, options);

        this.storage = storage;
        this.client = storage.client;
        this.player = storage.owner;

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
            this.env = Object.assign({
                HOME: '/',
                MAXHISTORY: 10,
                PROMPT: '> ',
                SHLVL: 1,
                USER: 'guest'
            }, this.options.env);
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
        setTimeout(() => this.renderPrompt(), 0);
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
     * @param {any} cmd
     */
    executeCommand(cmd) {
        return this.storage.executeCommand(cmd);
    }

    expandVariable(key, defaultValue = false) {
        if (this.env) {
            if (key in this.env === false)
                return defaultValue;

            let val = this.env[key];
            if (typeof val === 'function')
                return val() || defaultValue;
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
     * Process command source
     * @param {string} input The source to process
     */
    process(input) {
        let i = 0,
            command = false,
            commandIndex = 0,
            options = this.options,
            source = input.slice(0),
            m = source.length,
            contexts = [],
            isEscaped = false,
            isString = false,
            inExpr = false;

        let take = (n = 1, start = false) => {
            if (typeof n === 'number') {
                let ret = source.slice(i, i + n);
                i += n;
                return ret;
            }
            else if (n instanceof RegExp) {
                let ret = n.exec(source.slice(start || i));
                if (ret) {
                    i = (start ? start : i) + ret[0].length ;
                    return ret.length > 1 ? ret : ret[0];
                }
                return false;
            }
            else if (typeof n === 'string') {
                let s = start || i, test = source.slice(s, s + n.length);
                if (test === n) {
                    i += n.length;
                    return n;
                }
                return false;
            }
            throw new Error(`Unexpected take() expression: ${typeof n}`);
        };
        let getContext = () => {
            return contexts.length > 0 && contexts[0].type;
        };
        let nextToken = (start = false, expect = false) => {
            let token = { value: '', type: TT.Word, start: i = start || i, end: -1 };
            for (let done= false; !done && i < m; i++) {
                let c = source.charAt(i);

                if (isEscaped) {
                    token.value += c;
                    continue;
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
                        if (this.options.expandFileExpressions) {
                            token.value += c;
                            token.type = TT.FileExpression;
                        }
                        else
                            token.value += c;
                        break;

                    case ';':
                        if (this.options.allowChaining) {
                            token = { type: TT.Operator, subType: TT.CmdSeperator, start: i, end: ++i };
                            done = true;
                        }
                        else
                            token.value += c;
                        break;

                    case '|':
                        if (this.options.allowChaining) {
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
                        if (this.options.allowChaining) {
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
                        if (this.options.allowObjectShell && inExpr) {
                            token.isExpression = inExpr = true;
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
                                token.type = TT.MethodCall;
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
                                token.type = TT.MemberGet;
                                
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
                            inExpr = contexts[0] && contexts[0].isExpression || false;
                        }
                        else
                            token.value += c;
                        break;

                    case '=':
                        if (this.options.allowObjectShell) {
                            if (take('==')) {
                                //  Equality operator
                            }
                            else {
                                token.lhs = contexts.shift();
                                if (!token.lhs || token.lhs.type !== 'variable') {
                                    throw new Error(`Unexpected token '=' at position ${i}`);
                                }
                                token.type = 'assignment';
                                token.value = '=';
                                let next = nextToken(++i);
                                while (next.type === TT.WS) {
                                    next = nextToken();
                                }
                                token.rhs = next;
                                token.end = next.end;
                                done = true;
                            }
                        }
                        else
                            token.value += c;
                        break;

                    case ',':
                        if (this.options.allowObjectShell) {
                            token.type = 'operator';
                            token.value = ',';
                            token.end = ++i;
                            done = true;
                        }
                        else
                            token.value += c;
                        break;

                    case '$':
                        if (this.options.allowEnvironment) {
                            let name = nextToken(++i, TT.Word);
                            token.isExpression = inExpr = true;
                            token.type = TT.Variable;
                            token.value = name.value;
                            i = token.end = name.end;

                            if (this.options.allowObjectShell) {
                                //  Member expression
                                if (take('.')) {
                                    token.type = TT.MemberExpression;
                                    contexts.unshift(token);Krit
                                    return nextToken(--i);
                                }
                                // Member expansion
                                else {
                                    token.type = TT.VariableValue;
                                    token.value = this.expandVariable(name.value);
                                }
                            }
                            else {
                                //  Variable looks only/expands input
                                let value = {
                                    type: TT.Word,
                                    rawValue: this.expandVariable(token.value),
                                    $var: source.slice(token.start, token.end),
                                    start: i,
                                    end: -1
                                };

                                value.value = `${value.rawValue}`;
                                source = source.slice(0, token.start) + value.value + source.slice(token.end);
                                i = token.start + value.value.length;
                                value.start = token.start;
                                m = source.length;
                                value.end = i;
                                token = value;
                                done = true;
                            }
                        }
                        else
                            token.value += c;
                        break;

                    case '[': // Array expression or indexer
                        if (this.options.allowObjectShell && inExpr && getContext() === TT.MemberExpression) {
                            token.type = TT.Indexer;

                            let key = nextToken();
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
                        if (this.options.allowObjectShell && inExpr) {
                            token.type = c === '(' ? TT.PList : TT.Array;
                            token.value = c;
                            token.end = ++i;
                            token.args = [];

                            contexts.unshift(token);

                            let endsWith = token.type === TT.PList ? ')' : ']';
                            while (!take(endsWith)) {
                                let next = nextToken();
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
                        if (this.options.allowObjectShell && inExpr) {
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

                            if (this.options.allowObjectShell && take('.')) {
                                //  TODO: Look up in object registry to see if this token exists...
                                if (token.value === 'process') {
                                    token.type = 'object';
                                    token.value = process;
                                    contexts.unshift(token);
                                    return nextToken(--i);
                                }

                            }
                            done = true;
                        }
                        else if (inExpr)
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
            if (expect) {
                if (Array.isArray(expect) && expect.indexOf(token.type) === -1)
                    throw new Error(`Error: Got token type '${token.type}' but expected '${expect.join(', ')}' at position ${token.start}`);
                if (token.type !== expect) 
                    throw new Error(`Error: Got token type '${token.type}' but expected '${expect}' at position ${token.start}`);
            }

            token.isValueType = ValueTypes.indexOf(token.type) > -1;

            if (!command && token.type === TT.Word) {
                command = {
                    type: TT.Command,
                    verb: token,
                    index: commandIndex++,
                    start: token.start,
                    end: token.end,
                    args: []
                };
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
                command.end = i;
                command.source = source.slice(command.start, command.end);
                command.text = source.slice(command.verb.end, command.end).trim();
                return command;
            }
                
            return !!token.value && token;
        };

        for (let lastResult = false; i < m;) {
            let tok = nextToken();

            switch (tok.type) {
                case TT.Command:
                    try {
                        lastResult = this.executeCommand(tok);
                    }
                    catch (err) {
                        lastResult = err;
                    }
                    break;

                case TT.Operator:
                    {
                        switch (tok.subType) {
                            case TT.CmdSeperator:
                                break;

                            case TT.LogicalAND:
                                break;

                            case TT.LogicalOR:
                                break;

                            case TT.Pipeline:
                                break;

                            default:
                                throw new Error(`Unrecognized command operator `);
                        }
                    }

                default:
                    throw new Error(`Unexpected token: ${tok.type} starting at position ${tok.start}`);
            }
        }
    }

    /**
     * Process a single line of user input.
     * @param {string} input The user's line of input.
     */
    processInput(input) {
        driver.driverCall('input', ecc => {

            //  Set up for the next command
            ecc.whenCompleted(() => {
                this.executing = false;
                this.inputTo = false;
                setTimeout(() => this.renderPrompt(), 1);
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
                                if (inputTo.callback(input) !== true) {
                                    //  The modal frame did not recapture the user input
                                    let index = this.inputStack.indexOf(inputTo);
                                    if (index > -1) {
                                        this.inputStack.splice(index, 1);
                                    }
                                }
                            }
                            else if (input instanceof Error) {
                                this.stderr.write(`\n${input.message}\n\n`);
                            }
                            return true;
                        }
                    });

                    if (inputTrapped) {
                        this.flushAll();
                        return true;
                    }
                }
                if (this.options.allowHistory) {
                    input = this.expandHistory(input);
                }
                return this.process(input);
            }
            catch (err) {
                efuns.failLine(`-kmsh: ${err.message}`);
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
        if (this.storage && this.storage.connected) {
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
