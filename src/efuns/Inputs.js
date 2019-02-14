/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Helper methods for user input interactions
 */
const
    OP_AND = '&&',
    OP_OR = '||',
    OP_PIPE = '|',
    OP_SEMI = ';',
    OP_INPUT = '<';

const
    T_BG = 'BG',
    T_IO = 'IO',
    T_INPUT = 'INPUT',
    T_OPERATOR = 'OP',
    T_WORD = 'WORD';

class InputHelper {
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

    /**
     * @typedef {Object} SplitCommandOptions
     * @property {Object.<string,string>} [aliases] The user's aliases
     * @property {boolean} [allowBackground] Indicates the user can make a command async by appending (&)
     * @property {boolean} allowChaining Indicates operators like logical and (&&), local or (||), and semicolons (;) are parsed
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
     * Splits a command into verb and other component parts per the options selected.
     * @param {string} text The original input from the user
     * @param {SplitCommandOptions} options Options when parsing
     * @returns {MUDInputEvent[]} One or more command statements
     */
    static splitCommand(source, options = {}) {
        let settings = Object.assign({
            allowBackground: false,
            allowChaining: false,
            allowFileExpressions: false,
            allowFileIO: false,
            allowInputRedirect: false,
            allowPiping: false,
            expandHistory: true,
            expandVariables: true,
            history: {},
            variables: {}
        }, options);

        let i = 0,
            m = source.length,
            cmd,
            cmds = [],
            prev,
            eatWhitespace = (n = 0) => {
                let ws = '';
                while (i < m && /\s+/.test(source.charAt(i)))
                    ws += source.charAt(i++);
                return ws;
            },

            nextToken = (n = 0) => {
                let isEscaped = false,
                    isString = false,
                    result = { value: '', type: T_WORD, pos: i, arg: '' },
                    sendToken = token => {
                        if (token) {
                            if (!result.value) {
                                i = token.pos + token.value.length;
                                return token;
                            }
                            //  We want to return to this token next
                            result.end = token.pos - 1;
                            i = token.pos;
                            return result;
                        }
                        return result;
                    };
                if (i === m)
                    return false;
                for (; i < m; i++) {
                    let c = source.charAt(i);
                    if (isEscaped) result.value += c;
                    else switch (c) {
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
                                if (settings.allowChaining) {
                                    if (result.value)
                                        return sendToken();
                                    return sendToken({ type: T_OPERATOR, value: OP_AND, pos: i });
                                }
                            }
                            else if (source.charAt(i + 1) !== '>') {
                                if (settings.allowBackground)
                                    return sendToken({ type: T_BG, value: 'true', pos: i });
                                result.value += c;
                                break;
                            }
                        /* intentionally fall through to I/O */

                        case '1':
                        case '2':
                            if (source.charAt(i + 1) !== '>') {
                                result.value += c;
                                break;
                            }
                        /* intentionally fall through to I/O */

                        /* I/O redirect stuff */
                        case '>':
                        case ':':
                            if (settings.allowFileIO) {
                                let n = source.charAt(i + 1),
                                    nn = source.charAt(i + 2),
                                    mode = c + (n === '>' ? n : '') + (nn === '>' ? nn : '');

                                if (mode === '&') {
                                    if (settings.allowBackground)
                                        return sendToken({ type: T_BG, value: 'true', pos: i });
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
                                    let arg = nextToken();
                                    if (!arg)
                                        throw new Error(`-kmsh: Missing expected token WORD after ${mode} I/O operator at position ${i}`);
                                    if (arg.type !== T_WORD)
                                        throw new Error(`-kmsh: Unexpected token ${result.arg.type} after ${mode} at position ${i}`);
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
                            if (source.charAt(i + 1) === '|' && settings.allowChaining) {
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
                            if (settings.allowChaining) {
                                return sendToken({ type: T_OPERATOR, value: OP_SEMI, pos: i });
                            }
                            result.value += c;
                            break;

                        case '$':
                            result.hasVariables = true;
                            result.value += c;
                            break;

                        case '!':
                            result.hasHistory = true;
                            result.value += c;
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
                                if (result.value)
                                    return result.arg = ws, sendToken();
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
            nextCommandOrOperator = () => {
                let result = false, token;
                while (token = nextToken()) {
                    switch (token.type) {
                        case T_BG:
                            if (!result)
                                throw new Error(`-kmsh: Unexpected token (&) at position ${token.pos}; Expected command.`);
                            result.background = true;
                            break;

                        case T_IO:
                            if (!result)
                                throw new Error(`-kmsh: Unexpected token (${token.value}) at position ${token.pos}; Expected command.`);
                            result.io.push({ mode: token.value, arg: token.path });
                            break;

                        case T_OPERATOR:
                            if (result) {
                                if (typeof result.end === 'undefined')
                                    result.end = token.pos - 1, i = token.pos;
                                return result;
                            }
                            return token;

                        case T_WORD:
                            if (!result) {
                                result = {
                                    verb: token.value,
                                    background: false,
                                    args: [],
                                    original: token.value + token.arg,
                                    hasHistory: token.hasHistory === true,
                                    hasVariables: token.hasVariables === true,
                                    hasWildcards: token.hasWildcards === true,
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
                                result.args.push(token.value);
                                result.text += token.value + token.arg;
                                result.original += token.value + token.arg;
                                result.hasHistory |= token.hasHistory;
                                result.hasVariables |= token.hasVariables;
                                result.hasWildcards |= token.hasWildcards;
                                if ((result.end = token.end) > 0)
                                    return result;
                            }
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

        while (cmd = nextCommandOrOperator()) {
            if (cmd.verb) {
                cmds.push(prev = cmd);
            }
            else if (cmd.type == T_OPERATOR) {
                let op = cmd;
                cmd = nextCommandOrOperator();
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
        return cmds;
    }
}

module.exports = InputHelper;
