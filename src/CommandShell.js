/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 20, 2019
 *
 * Description: Command interpreter for MUD objects.
 */

const
    IO = require('./StandardIO'),
    MUDEventEmitter = require('./MUDEventEmitter');

const
    Context = {
        ScriptBody: 1,
        VariableRef: 2
    };

class CommandShell extends MUDEventEmitter {
    constructor(options = {}) {
        super();

        this.options = Object.assign({
            allowAliases: false,
            allowEnvironment: false,
            allowEscaping: false,
            allowFileIO: false,
            allowHistory: false,
            allowObjectShell: false
        }, options);

        this.stdin = new IO.StandardInputStream({ encoding: 'utf8' });
        this.stdout = new IO.StandardPassthruStream({ encoding: 'utf8' }, s => console.log(s));
        this.stderr = new IO.StandardPassthruStream({ encoding: 'utf8' }, s => console.log(s));
        this.stdnull = new IO.StandardPassthruStream({ encoding: 'utf8' }, s => s);

        this.source = '';

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
    }

    /**
     * Start reading input from the shell's owner
     */
    enter() {
    }

    /**
     * Process command source
     * @param {string} input The source to process
     */
    process(input) {
        let i = 0,
            source = input.slice(0),
            m = source.length,
            contexts = [],
            isEscaped = false,
            isString = false;

        let take = (n = 1, start = false) => {
            if (typeof n === 'number') {
                let ret = input.slice(i, i + n);
                i += n;
                return ret;
            }
            else if (n instanceof RegExp) {
                let ret = n.exec(input.slice(start || i));
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
        let nextToken = (start = false, expect = false) => {
            let token = { value: '', type: 'word', start: i = start || i, end: -1 };
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

                    case '!':
                        if (this.options.allowHistory) {

                        }
                        else
                            token.value += c;
                        break;

                    case ';':
                        token.type = 'operator';
                        token.value = ';';
                        done = true;
                        break;

                    case '|':
                        if (source.charAt(i + 1) === '|') {
                            token.type = 'operator';
                            token.value = '||';
                            done = true;
                        }
                        else {
                            token.type = 'operator';
                            token.value = '|';
                            done = true;
                        }
                        break;

                    case '&':
                        if (take('&')) {
                            token.type = 'operator';
                            token.value = '&&';
                            done = true;
                        }
                        break;

                    case '.':
                        if (this.options.allowObjectShell) {
                            token.target = contexts.shift();
                            token.type = 'propertyAccess';
                            token.member = nextToken(token.end = ++i, 'word');

                            if (take('(')) {
                                token.type = 'methodCall';
                                token.args = [];

                                while (!take(')')) {
                                    let next = nextToken();
                                    if (!next)
                                        throw new Error(`Unexpected end of argument list at position ${i}`);
                                    token.end = next.end;
                                    if (next.value === ',') continue;
                                    else if (next.type === 'whitespace') continue;
                                    else if (next.type === 'word') {
                                        if (next.value === 'true' || next.value === 'false') {
                                            next.value = next.value === 'true';
                                            next.type = 'boolean';
                                        }
                                        else {
                                            let val = parseFloat(next.value);
                                            if (!isNaN(val)) {
                                                next.value = val;
                                                next.type = 'number';
                                            }
                                            else
                                                next.type = 'string';
                                        }
                                        token.args.unshift(next);
                                    }
                                    else if (next.type === 'variable') {
                                        token.args.unshift(next);
                                    }
                                    if (take(')')) break;
                                    next = nextToken();
                                }
                                token.end = i;
                                token.value += `${token.target.value}.${token.member.value}(`;
                                token.args.forEach((a, i) => {
                                    token.value += (i > 0 ? ', ' : '') + a.value;
                                });
                                token.value += ')';
                                done = true;
                            }
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
                                while (next.type === 'whitespace') {
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
                        let name = nextToken(++i, 'word');
                        token.type = 'variable';
                        token.value = name.value;
                        i = token.end = name.end;

                        if (this.options.allowObjectShell && take('.')) {
                            contexts.unshift(token);
                            return nextToken(--i);
                        }
                        else if (contexts.length === 0) {
                            contexts.unshift(token);
                            let next = nextToken();

                            //  Should be an assignment
                            while (next.type === 'whitespace') {
                                next = nextToken();
                            }
                            this.env[token.value] = next;
                            done = true;
                        }
                        else {
                            //  Variable expansion
                            let val = this.env[token.value] || '';
                        }
                        done = true;
                        break;

                    case '(':
                    case ')':
                        if (this.options.allowObjectShell) {
                            token.type = 'parameters';
                            token.value = c;
                            token.end = ++i;
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
                                token.type = 'whitespace';
                                i += (token.value = take(/^\s+/, i)).length;
                                token.end = i;
                                done = true;
                            }
                        }
                        else if (isString) {
                            token.value += c;
                        }
                        else {
                            i += (token.value += take(/^[a-zA-Z0-9_]+/, i)).length;
                            token.end = i;
                            if (this.options.allowObjectShell && take('.')) {
                                //  TODO: Look up in object registry to see if this token exists...
                                token.type = 'object';
                                contexts.unshift(token);
                                return nextToken(--i);
                            }
                            done = true;
                        }
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
            return !!token.value && token;
        };

        for (; i < m;) {
            let tok = nextToken();
            console.log(tok);
        }
    }

    processInput(input) {
        return this.process(input);
    }

    get prompt() {
        return this.env.PROMPT || '> ';
    }
}

module.exports = CommandShell;
