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
    TT = {
        Array: 'arrayExpression',
        Assignment: 'assignment',
        Boolean: 'boolean',
        Indexer: 'memberIndexer',
        MemberGet: 'memberGet',
        MemberExpression: 'memberExpression',
        MethodCall: 'methodCall',
        Number: 'number',
        Object: 'objectExpression',
        PList: 'parameterList',
        String: 'string',
        Word: 'word',
        WS: 'whitespace'
    },
    ValueTypes = [ TT.Array, TT.Boolean, TT.Number, TT.Object, TT.String, TT.Word ],
    B_TRUE = 'true',
    B_FALSE = 'false';

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
            isString = false,
            inExpr = false;

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
                            //  Evaluate previous command to see if it succeeded
                            token.type = 'operator';
                            token.value = '&&';
                            done = true;
                        }
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
                        let name = nextToken(++i, TT.Word);
                        token.isExpression = inExpr = true;
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
                            while (next.type === TT.WS) {
                                next = nextToken();
                            }
                            if (next.type !== TT.Assignment)
                                throw new Error(`Unexpected token '${next.type}' [expected 'assignment']`);
                            this.env[next.lhs.value] = next.rhs.value;
                            done = true;
                        }
                        else {
                            //  Variable expansion
                            let val = this.env[token.value] || '';
                        }
                        done = true;
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
