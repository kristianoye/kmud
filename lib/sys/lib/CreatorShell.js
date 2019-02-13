/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 9, 2019
 *
 * The creator command shell.  It:
 *      - executes commands, 
 *      - stores command history, 
 *      - saves command history,
 *      - expands file expressions,
 *      - expand environmental variables,
 *      - allows I/O redirecting
 */
const
    Daemon = require('Daemon'),
    PlayerShell = require('./PlayerShell'),
    CommandResolver = efuns.loadObjectSync(Daemon.Command);

const
    OP_AND = 'and',
    OP_OR = 'or',
    OP_STACK = 'stack';

class CreatorShell extends PlayerShell {
    constructor(user, env) {
        super(user);

        register('directoryStack', ['/']);
        register(':env', Object.assign({
            $$: this.instanceId,
            $0: "-kmcsh",
            HISTSIZE: "1000",
            HOME: `/realms/${user.name}`,
            LANG: 'en_US.UTF-8',
            SHLVL: "1",
            TERM: "",
            USER: user.name
        }, env));
    }

    /** @type {string[]} */
    get directoryStack() {
        return get('directoryStack', '/') || '/base';
    }

    private set directoryStack(value) {
        set('directoryStack', value);
    }

    /**
     * Expand file expressions that contain wildcards (* or ?).
     * @param {string} expr The input string after variable expansion, etc.
     * @returns {string} The user input with file expressions expanded.
     */
    expandFileExpressions(expr) {
        //  Nothing to be done here
        if (expr.indexOf('*') === -1 && expr.indexOf('?'))
            return expr;

        let i = 0,
            wd = this.workingDirectory,
            m = expr.length,
            output = '',
            word = '',
            s = 0,
            doExpand = false,
            isEscaped = false,
            inString = false;

        for (; i < m; i++) {
            let c = expr.charAt(i);

            switch (c) {
                case '\\':
                    if (isEscaped)
                        word += c, isEscaped = false;
                    else
                        isEscaped = true;
                    break;

                case '"':
                    if (isEscaped)
                        word += c, isEscaped = false
                    else
                        inString = !inString;
                    break;

                case '?':
                case '*':
                    if (isEscaped)
                        word += c, isEscaped = false;
                    else
                        word += c, doExpand = true;
                    break;

                default:
                    let isWS = /\s/.test(c);
                    word += c, isEscaped = false;
                    if (isWS || i + 1 === m) {
                        if (doExpand) {
                            let files = efuns.readDirectorySync(efuns.resolvePath(word.trim(), wd)),
                                slash = word.lastIndexOf('/');
                            if (slash > -1) {
                                files = files.map(s => word.slice(0, slash + 1) + s);
                            }
                            if (files.length === 0)
                                output += word;
                            else
                                output += files.join(' ') + ' ';
                        }
                        else
                            output += word;
                        word = '';
                        doExpand = false;
                    }
                    break;
            }
        }
        if (word) output += word;
        return output;
    }

    /**
     * Only do fancy command expansion/splitting for certain command scenarios
     * @param {string} verb The first verb used must be filesystem-related to
     * warrant further processing (or input must be prefixed with a [+] plus)
     */
    static isShellCommand(verb) {
        return CommandResolver().isShellCommand(verb);
    }

    /**
     * Process user input and return the user input
     * @param {string} raw The raw input from the user.
     * @returns {MUDInputEvent|MUDInputEvent[]} The input to execute.
     */
    processInput(raw) {
        let splitCommand = false, user = this.user,
            cmd = super.processInput(raw.trim());

        //  Ensure full processing regardless of first verb
        if (cmd.verb.charAt(0) === '+') {
            splitCommand = true; 
            cmd.text = cmd.text.slice(1);
        }
        else if (CreatorShell.isShellCommand(cmd.verb))
            splitCommand = true;

        if (splitCommand) {
            let cmds = this.splitCommands(cmd.original),
                history = this.history,
                nextId = this.historyNext();

            history[nextId] = cmd.original;

            if (history.length > this.maxHistory)
                history.splice(0, nextId - this.maxHistory);

            return cmds;
        }
        return cmd;
    }

    /**
     * Splits user input into statements and commands.
     * @param {string} originalSource The original input from the user
     * @returns {MUDInputEvent[]} One or more command statements
     */
    protected splitCommands(originalSource) {
        let text = originalSource.slice(0),
            thisCommand = '',
            ioMode = false,
            i = 0, io = {},
            m = text.length,
            commands = [],
            prev = false,
            last = false,
            thisOp = false,
            eatWhitespace = (m) => {
                let ws = '';
                while (i < m && /\s+/.test(text.charAt(i)))
                    ws += text.charAt(i++);
                return i += m || 0, ws.length;
            },
            makeCommand = (bg, op) => {
                if (thisCommand.trim().length > 0) {
                    let cmd = efuns.input.splitCommand(
                        this.expandFileExpressions(
                            this.expandVariables(
                                this.expandAliases(
                                    this.expandHistory(thisCommand)))),
                        true);

                    cmd.io = io;

                    if (cmd.background = bg === true)
                        throw new Error(`Background processes are not currently allowed.`);

                    if (prev && thisOp) {
                        if (thisOp === OP_AND) 
                            prev.conditions ?
                                prev.conditions.push(last = cmd) :
                                prev.conditions = [last = cmd];
                        else if (thisOp === OP_OR)
                            prev.alt = cmd, prev = last = cmd;
                        else if (thisOp === OP_STACK) {
                            last.then = cmd, last = cmd;
                        }
                        thisOp = op || false;
                    } else {
                        commands.push(prev = last = cmd);
                        thisOp = op;
                    }
                }
                thisCommand = '';
            },
            inQuotes = false, //  The current text is part of a quoted string
            isEscaped = false;  //  There was an escape/slash previously

        for (eatWhitespace(0); i < m; i++) {
            let c = text.charAt(i),
                n = i < m && text.charAt(i + 1);

            if (isEscaped) {
                if (ioMode)
                    io[ioMode] += c;
                else
                    thisCommand += c;
                isEscaped = false;
                continue;
            }

            switch (c) {
                case '"': // Quote - start or end a phrase
                case "'":
                    if (inQuotes === c)
                        inQuotes = false;
                    else if (inQuotes) {
                        if (ioMode)
                            io[ioMode] += c;
                        else
                            thisCommand += c;
                    }
                    else
                        inQuotes = c;
                    break;

                case '\\': // Escape Slash - next character is literal
                    isEscaped = true;
                    break;

                case '|':
                    if (n === '|') {
                        if (!thisCommand)
                            throw new Error(`Bad command syntax: || operator must follow a command.`);
                        ++i && makeCommand(false, OP_OR);
                    }
                    else {
                        if (!last)
                            throw new Error(`Bad command syntax: | operator must follow a command`);
                        makeCommand(false, OP_STACK);
                    }
                    break;

                case '1':
                case '2':
                case '>':
                case '&':
                case ':':
                    if (ioMode) 
                        throw new Error(`-kmsh: Unterminated file I/O specification`);
                    ioMode = c;
                    switch (n) {
                        case '>':
                        case '':
                            ioMode += n;
                            i++;

                            if (text.charAt(i + 1) === '>') {
                                ioMode += c;
                                i++;
                            }
                            break;
                    }
                    switch (ioMode) {
                        case '>':
                        case '>>':
                        case '1>':
                        case '1>>':
                        case '2>':
                        case '2>>':
                        case '&>':
                        case '&>>':
                        case ':>':
                            io[ioMode] = '';
                            break;

                        default:
                            throw Error(`-kmsh: Unrecognized I/O redirect pattern: ${ioMode}`);
                    }
                    break;

                case '&':
                    if (n === '&') {
                        if (!thisCommand)
                            throw new Error(`Bad command syntax: && operator must follow a command.`);
                        ++i && makeCommand(false, OP_AND);
                    }
                    else {
                        throw new Error(`Background processing is not currently supported.`);
                        makeCommand(true);
                    }
                    break;

                case ';':
                    makeCommand();
                    break;

                default:
                    let isWS = /\s/.test(c)
                    if (isWS) {
                        if (ioMode && io[ioMode].length > 0)
                            ioMode = false;
                    }
                    if (ioMode && !isWS)
                        io[ioMode] += c;
                    else if (!ioMode)
                        thisCommand += c;
                    break;
            }
        }

        if (inQuotes)
            throw new Error(`Undeterminated quotes after ${thisCommand}`);

        makeCommand();

        return commands;
    } 

    /**
     * Returns the directory at the top of the user's directory stack.
     * @type {string}
     */
    get workingDirectory() {
        let stack = this.directoryStack;
        return stack[0];
    }
}

CreatorShell.prototype.$friends = ['/base/Creator'];

module.exports = CreatorShell;
