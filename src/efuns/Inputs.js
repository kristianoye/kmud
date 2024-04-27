/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Helper methods for user input interactions
 */
const
    BaseInput = require('../inputs/BaseInput');

const
    OP_AND = '&&',
    OP_OR = '||',
    OP_PIPE = '|',
    OP_SEMI = ';',
    OP_INPUT = '<';

const
    T_BACKGROUND = 'BG',
    T_IO = 'IO',
    T_INPUT = 'INPUT',
    T_OPERATOR = 'OP',
    T_IDENTIFIER = 'IDENTIFIER',
    T_WORD = 'WORD';

class InputHelper {
    /**
     * @typedef {Object} SplitCommandOptions
     * @property {Object.<string,string>} [aliases] The user's aliases
     * @property {boolean} [allowAsyncCommands] Indicates the user can make a command async by appending (&)
     * @property {boolean} allowPipelining Indicates operators like logical and (&&), local or (||), and semicolons (;) are parsed
     * @property {boolean} allowFileExpressions Indicates that file expressions should be expanded, otherwise it is treated as literal text.
     * @property {boolean} allowFileIO Indicates file I/O operations should be parsed out, otherwise it is literal text.
     * @property {boolean} allowFunctionVariables Controls whether variables can be functions.
     * @property {boolean} allowInputRedirect Allows user to read one or more file in as STDIN
     * @property {boolean} allowPiping Indicates command piping will be split out, otherwise it is literal text.
     * @property {boolean} expandAliases Controls whether aliases are expanded or not.
     * @property {boolean} expandVariables Control whether variable expansion occurs or not.
     * @property {boolean} expandHistory Control whether history expansion occurs or not.
     * @property {Object.<number,string>} [history] The user's history
     * @property {Object.<string,function(...string):string>} [variables] The user's environment variables
     * @property {function(MUDInputEvent,SplitCommandOptions):boolean} [onFirstVerb] A callback to execute once the first verb is determined. This can be used to modify the split settings.
     * @property {MUDObject} [user] The user running the command.
     */
    /**
     * Monolithic method that splits a command into verb and other component parts per the options selected.
     * @param {string} text The original input from the user
     * @param {SplitCommandOptions} [options] Options when parsing
     * @returns {MUDInputEvent[]} One or more command statements prepared for execution
     */
    static async splitCommand(source, options = {}) {
        let settings = Object.assign(
            {
                allowAsyncCommands: false,
                allowPipelining: false,
                allowFileExpressions: false,
                allowFileIO: false,
                allowInputRedirect: false,
                allowPiping: false,
                expandAliases: false,
                expandHistory: false,
                expandVariables: false
            }, options),
            i = 0,
            m = source.length,
            cmd,
            cmds = [],
            prev,
            forHistory = '',
            fromHistory = false,
            printOnly = false;

        settings.expandHistory = settings.expandHistory === true || typeof settings.history === 'object';
        settings.expandAliases = settings.expandAliases === true || typeof settings.aliases === 'object';
        settings.expandVariables = settings.expandVariables === true || typeof settings.variables === 'object';

        let eatWhitespace = (n = 0) => {
                let ws = '';
                while (i < m && /\s+/.test(source.charAt(i)))
                    ws += source.charAt(i++);
                return ws;
            },
            take = (f, t) => {
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
                    if (check !== f)
                        return false;
                    i += check.length;
                    return check;
                }
                ret = source.slice(f = f || i, t = t || f + 1);
                i = t;
                return ret;
            },
            assertValid = (token, expect) => {
                if (!expect || token.type === expect)
                    return true;
                throw new Error(`Unexpected token ${token.type} at position ${token.pos}; Expected ${expect}`);
            },
            nextToken = /** @returns {{ type: string, value: string, pos: number }} */ (expect) => {
                let isEscaped = false,
                    isString = false,
                    result = { value: '', type: T_WORD, pos: i, arg: '' },
                    sendToken = (token, endCommand) => {
                        if (token) {
                            assertValid(token);
                            if (!result.value) {
                                i = token.pos + token.value.length;
                                token.end = token.pos + token.value.length;
                                return token;
                            }
                            //  We want to return to this token next
                            result.end = token.pos - 1;
                            result.endCommand = endCommand === true;
                            i = token.pos;
                            return result;
                        }
                        assertValid(result);
                        result.end = i;
                        return result;
                    };
                // We are at the end of the input
                if (i === m) return false;
                for (; i < m; i++) {
                    let c = source.charAt(i);
                    if (expect === T_IDENTIFIER) {
                        if (!/[a-zA-Z0-9]/.test(c)) {
                            result.type = T_IDENTIFIER;
                            result.end = i - 1;
                            return sendToken();
                        }
                    }
                    if (isEscaped) {
                        result.value += c;
                        isEscaped = false;
                        continue;
                    }
                    else switch (c) {
                        case '\\':
                            isEscaped = true;
                            break;

                        /* Quoted blocks */
                        case '"':
                        case "'":
                            if (isString === c)
                                isString = false;
                            else if (isString)
                                result.value += c;
                            break;

                        case '&':
                            if (source.charAt(i + 1) === '&') {
                                if (settings.allowPipelining) {
                                    if (result.value)
                                        return sendToken();
                                    return sendToken({ type: T_OPERATOR, value: OP_AND, pos: i });
                                }
                            }
                            else if (source.charAt(i + 1) !== '>') {
                                if (settings.allowAsyncCommands)
                                    return sendToken({ type: T_BACKGROUND, value: 'true', pos: i });
                                result.value += c;
                                break;
                            }
                        /* intentionally fall through to I/O */

                        case '1':
                        case '2':
                        case ':':
                            if (source.charAt(i + 1) !== '>') {
                                result.value += c;
                                break;
                            }
                        /* intentionally fall through to I/O */

                        /* I/O redirect stuff */
                        case '>':
                            if (settings.allowFileIO) {
                                let n = source.charAt(i + 1),
                                    nn = source.charAt(i + 2),
                                    mode = c + (n === '>' ? n : '') + (nn === '>' ? nn : '');

                                if (mode === '&') {
                                    if (settings.allowAsyncCommands)
                                        return sendToken({ type: T_BACKGROUND, value: 'true', pos: i });
                                    else {
                                        result.value += c;
                                        break;
                                    }
                                }
                                else {
                                    /*
                                        case '>':
                                        case '>>':
                                        case ':>':
                                        case '&>':
                                        case '&>>':
                                        case '1>':
                                        case '1>>':
                                        case '2>':
                                        case '2>>':
                                     */
                                    if (result.value)
                                        return sendToken();

                                    i += mode.length;
                                    let arg = nextToken(T_WORD);
                                    result.value = mode;
                                    result.path = efuns.resolvePath(arg.value, settings.cwd || '/');
                                    result.type = T_IO;
                                    return sendToken();
                                }
                            }
                            else {
                                result.value += c;
                                break;
                            }

                        case '|':
                            if (source.charAt(i + 1) === '|' && settings.allowPipelining) {
                                return sendToken({ type: T_OPERATOR, value: OP_OR, pos: i });
                            }
                            else if (settings.allowPiping) {
                                /* eat extra pipes and whitespace */
                                return sendToken({ type: T_OPERATOR, value: OP_PIPE, pos: i });
                            }
                            else
                                result.value += c;
                            break;

                        case ';':
                            if (settings.allowPipelining) {
                                return sendToken({ type: T_OPERATOR, value: OP_SEMI, pos: i }, true);
                            }
                            result.value += c;
                            break;

                        case '$':
                            if (settings.expandVariables && settings.variables) {
                                let env = settings.variables, pos = i;
                                if (typeof env === 'object') {
                                    let varToken = ++i && nextToken(T_IDENTIFIER),
                                        varValue = env[varToken.value] || '',
                                        varLen = varToken.value.length;
                                    if (varValue) {
                                        if (typeof varValue === 'function') {
                                            if (settings.allowFunctionVariables)
                                                varValue = varValue.apply(settings.user) || '';
                                            else
                                                varValue = '';
                                        }
                                    }
                                    result.value += `${varValue}`;
                                    i = pos + varLen;
                                }
                            }
                            else
                                result.value += c;
                            break;

                        case '!':
                            if (settings.expandHistory && typeof settings.history === 'object') {
                                let found = '',
                                    start = i++,
                                    search = '!',
                                    index = -1,
                                    arg = { end: i },
                                    history = settings.history;

                                if (take('!')) found = history[history.length - 1];
                                else if (take('%')) found = history.keyword || '';
                                else {
                                    let contains = take('?'), searchBack = take('-');
                                    arg = nextToken(T_IDENTIFIER);
                                    search = arg.value, index = parseInt(search), found = false
                                    if (isNaN(index)) {
                                        if (contains)
                                            for (let i = history.length - 1; !found && i > -1; i--) {
                                                let n = history[i].indexOf(search)
                                                if (n > -1) {
                                                    let args = InputHelper.splitArgs(found = history[i], true);
                                                    for (let x = 0; x < args.length; x++) {
                                                        if (args[x].indexOf(search) > -1) {
                                                            history.keyword = args[x];
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        else
                                            for (let i = history.length - 1; !found && i > -1; i--) {
                                                if (history[i].startsWith(search))
                                                    found = history[i];
                                            }
                                    }
                                    else if (index > 0) {
                                        if (searchBack)
                                            found = history[history.length - index];
                                        else
                                            found = history[index];
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
                                        if (take('&')) {
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
                                            throw Error(`Unrecognized expression starting at position ${i-1}`);
                                    }
                                    arg.end = i;
                                }
                                source = source.slice(0, start) + found.trim() + source.slice(arg.end + 1).trim();
                                i = start - 1; // Rewind even if it goes to -1
                                m = source.length; // Update max length to reflect new size
                                fromHistory = true;
                            }
                            else
                                result.value += c;
                            break;

                        case '^':
                            if (settings.expandHistory && typeof settings.history === 'object') {
                                let start = i, searchFor = ++i && nextToken(T_IDENTIFIER);
                                let replaceWith = ++i &&  nextToken(T_IDENTIFIER);
                                let lastCommand = settings.history[settings.history.length - 1];
                                if (!lastCommand) {
                                    throw Error('^: event not found');
                                }
                                else {
                                    lastCommand = lastCommand.replace(searchFor.value, replaceWith.value);
                                }
                                source = source.slice(0, start) + lastCommand + source.slice(replaceWith.end + 1);
                                i = start - 1; // Rewind even if it goes to -1
                                m = source.length; // Update max length to reflect new size
                             }
                            break;

                        case '*':
                        case '?':
                            result.hasWildcards = true;
                            result.value += c;
                            break;

                        case '<':
                            if (settings.allowInputRedirect) {
                                if (result.value)
                                    return sendToken();
                                let arg = nextToken();
                                if (arg.type !== T_WORD)
                                    throw new Error(`Expected token WORD starting at position ${i + 1}`);
                                return sendToken({ type: T_INPUT, value: OP_INPUT, path: arg.value });
                            }
                            result.value += c;
                            break;

                        default:
                            let ws = eatWhitespace();
                            if (ws) {
                                 // Only trailing whitespace is appended.  Leading whitespace is ignored.
                                if (result.value) {
                                    forHistory += ws;
                                    return result.arg = ws, sendToken();
                                }
                                else
                                    i--;
                            }
                            else
                                result.value += c;
                            break;
                    }
                }
                if (i === m)
                    return sendToken();
                throw new Error(`Unexpected end of input at position ${i} / ${m}`);
            },
            nextCommandOrOperator = async () => {
                let result = false, token;
                while (token = nextToken()) {
                    switch (token.type) {
                        case T_BACKGROUND:
                            if (!result)
                                throw new Error(`-kmsh: Unexpected token (&) at position ${token.pos}; Expected command.`);
                            result.background = true;
                            forHistory += '&';
                            break;

                        case T_IO:
                            if (!result)
                                throw new Error(`-kmsh: Unexpected token (${token.value}) at position ${token.pos}; Expected command.`);
                            forHistory += token.value + ' ' + token.path;
                            result.io.push({ mode: token.value, arg: token.path });
                            break;

                        case T_OPERATOR:
                            if (result) {
                                if (typeof result.end === 'undefined') {
                                    result.end = token.pos;
                                }
                                result.text = source.slice(result.start, result.end);
                                forHistory += token.value + eatWhitespace();
                                return result;
                            }
                            return token;

                        case T_WORD:

                            //if (token.hasHistory && settings.expandHistory && typeof settings.history === 'object') {
                            //    let search = token.value, index = parseInt(search), found = false
                            //    if (isNaN(index)) {
                            //        for (let i = settings.history.length - 1; !found && i > -1; i--) {
                            //            if (settings.history[i].startsWith(search))
                            //                found = settings.history[i];
                            //        }
                            //    }
                            //    else if (settings.history[index])
                            //        found = settings.history[index];
                            //    if (!found)
                            //        throw Error(`${search}: event not found`);

                            //    forHistory += found + token.arg;

                            //    let words = found.split(/(?=[\s]+)/);
                            //    token.value = words.shift();
                            //    token.args = words;
                            //    token.arg = words.join('').trim();
                            //}
                            //else
                            forHistory += token.value + (token.arg || ' '); 

                            if (token.hasWildcards && settings.allowFileExpressions) {
                                let pathExpression = efuns.resolvePath(token.value.trim(), settings.cwd),
                                    files = await efuns.fs.readDirectoryAsync(pathExpression);

                                if (files.length > 0) {
                                    let ep = token.value.lastIndexOf('/');
                                    if (ep > -1) {
                                        let dir = token.value.slice(0, ep + 1);
                                        files = files.map(fn => dir + fn);
                                    }
                                    token.args = files;
                                    token.value = files.join(' ');
                                }
                            }
                            if (!result) {
                                result = {
                                    verb: token.value,
                                    background: false,
                                    args: token.args || [],
                                    original: token.value + token.arg,
                                    io: [],
                                    and: false,
                                    or: false,
                                    start: token.pos,
                                    text: ''
                                };
                                if (cmds.length === 0 && settings.onFirstVerb)
                                    settings.onFirstVerb(result, settings);
                            }
                            else if (token.value) {
                                if (Array.isArray(token.args))
                                    result.args.push(...token.args);
                                else
                                    result.args.push(token.value);

                                result.text += token.value + token.arg;
                                result.original += token.value + token.arg;

                            }
                            if (result.endCommand === true)
                                return result;
                            break;

                        case T_INPUT:
                            if (!result)
                                throw new Error(`Unexpected redirect operator at position ${token.pos}`);
                            result.stdin = efuns.resolvePath(token.path, this.cwd);
                            break;

                        default:
                            throw new Error(`Unexpected token type: ${token.type || '(UNKNOWN)'} at position ${i}`);
                    }
                }
                return result;
            };

        while (cmd = await nextCommandOrOperator()) {
            if (cmd.verb) {
                cmds.push(prev = cmd);
            }
            else if (cmd.type == T_OPERATOR) {
                let op = cmd;

                cmd = await nextCommandOrOperator();

                switch (op.value) {
                    case OP_AND:
                        if (!prev.tail)
                            prev.tail = prev.then = cmd;
                        else
                            prev.tail.then = cmd, prev.tail = cmd;
                        break;

                    case OP_OR:
                        prev.or = cmd, prev = cmd;
                        break;

                    case OP_PIPE:
                        prev.redirect = cmd, prev = cmd;
                        break;

                    case OP_SEMI:
                        prev = false;
                        cmds.push(cmd);
                        break;

                    default:
                        throw new Error(`Unhandled operator ${op.value} `)
                }
            }
            else if (cmd.type)
                throw new Error(`Unexpected token ${cmd.type} at position ${cmd.pos}`);
        }
        typeof settings.onWriteHistory === 'function' && settings.onWriteHistory(forHistory.trim());
        if (fromHistory) this.writeLine(forHistory.trim());
        return cmds;
    }

    /**
     * Splits a string into verb and statement
     * @param {string} input The text to split
     * @returns {[string,string]} The verb and text
     */
    static getVerb(input) {
        let text = input.trim(), i = 0, m = text.length;
        while (i < m && !/\s/.test(text.charAt(i))) i++;
        return [text.slice(0, i), text.slice(i).trim()];
    }

    static prompt(type, options = {}, callback=false) {
        if (typeof options === 'string') {
            options = { text: options };
        }
        if (typeof type === 'string') {
            if (!BaseInput.knownType(type)) {
                options = Object.assign({ text: type }, options);
                type = 'text';
            }
        }
        if (typeof callback === 'function')
            options.callback = callback;

        options = Object.assign({
            default: false,
            text: 'Prompt: ',
            type: 'text'
        }, options);

        let prompt = BaseInput.create(type, options, typeof options.callback === 'function' && options.callback),
            ecc = driver.getExecution();

        ecc.shell.addPrompt(prompt);
    }

    static async promptAsync(type, opts = {}) {
        if (typeof opts === 'string') {
            opts = { text: opts };
        }

        if (typeof type === 'string') {
            if (!BaseInput.knownType(type)) {
                opts = Object.assign({ text: type }, opts);
                type = 'text';
            }
        }

        opts = Object.assign({
            default: false,
            text: 'Prompt: ',
            type: 'text'
        }, opts, { isAsync: true });

        let ecc = driver.getExecution();
        return new Promise((resolve, reject) => {
            if (ecc && ecc.shell) {
                try {
                    let prompt = BaseInput.create(type, opts),
                        originalCallback = typeof prompt.callback === 'function' && prompt.callback;

                    prompt.callback = (input) => {
                        try {
                            if (originalCallback)
                                originalCallback(input);
                            resolve(input);
                        }
                        catch (err) {
                            reject(err);
                        }
                    };
                    ecc.shell.addPrompt(prompt);
                }
                catch (err) {
                    reject(err);
                }
            }
            else
                reject('No command shell present');
        });
    }

    /**
     * Splits a string into command arguments; Quoted values return as a single arg.
     * @param {string} input The input to parse
     * @returns {string[]} Returns the input split into argument form
     */
    static splitArgs(input, preserveWhitespace = false) {
        let text = input.trim(),
            isEscaped = false,
            isString = false,
            current = '',
            args = [],
            i = 0, s = 0,
            m = text.length,
            last = m - 1,
            eatWhitespace = () => {
                let ws = '';
                while (i < m && /\s+/.test(text.charAt(i)))
                    ws += text.charAt(i++);
                return preserveWhitespace ? ws : '';
            };

        for (let c, n = false; c = text.charAt(i), i < m; n = text.charAt(i + 1), i++) {
            if (isEscaped) {
                current += c, isEscaped = false;
                continue;
            }
            switch (text.charAt(i)) {
                case '\\':
                    if (i === last)
                        throw new Error(`Bad argument 1 to splitArgs: Last character cannot be an escape character.`);
                    isEscaped = true;
                    break;

                case '"':
                case "'":
                    if (isString && isString === c) {
                        isString = false;
                    }
                    else if (isString) {
                        current += c;
                    }
                    else {
                        isString = c;
                        s = i;
                    }
                    continue;

                default:
                    if (/\s/.test(c) && !isString) {
                        current += eatWhitespace();
                        if (current) {
                            args.push(current);
                        }
                        current = '';
                        i--;
                    }
                    else {
                        current += c;
                    }
            }
        }
        if (isString)
            throw new Error(`Bad argument 1 to splitArgs: Unterminated string staring at position ${s}`);

        if (current) {
            args.push(current);
        }

        return args;
    }
}

module.exports = InputHelper;
