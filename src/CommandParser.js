/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017-2020.  All rights reserved.
 * Date: October 6, 2020
 *
 * Description: Parser that splits a commandline into a command tree.
 */

const
    /*
     * A mud command eats all tokens to the end of the input without considering
     * command pipelining or object expressions (although it may contain variable expressions);
     */
    CMD_MUD = "MudCommand",
    /*
     * A shell command is one that can include file I/O, wildcard expressions, object
     * expressions, etc, but does not require special parsing
     */
    CMD_SHELL = "ShellCommand",
    /*
     * An expression command is one that requires processing (e.g. includes calculations, 
     * mathmatical expressions, function calls, etc)
     */
    CMD_EXPR = "ExpressionCommand";

const
    OP_AND = '&&',
    OP_ASSIGNMENT = '=',
    OP_BACKGROUND = '&',
    OP_COMPOUND = ';',
    OP_OR = '||',
    OP_PIPELINE = '|';

const
    TOKEN_ALIAS = 'Alias',
    TOKEN_HISTORY = 'History',
    TOKEN_MEMBERACCESS = 'MemberAccess',
    TOKEN_NUMERIC = 'Numeric',
    TOKEN_OPERATOR = 'Operator',
    TOKEN_STRING = 'String',
    TOKEN_VARIABLE = 'Variable',
    TOKEN_WHITESPACE = 'Whitespace',
    TOKEN_WORD = 'Word';

class ParsedCommand {
    constructor() {
        /** 
         * The type of command to execute 
         */
        this.cmdType = CMD_MUD;

        /** 
         * The command verb 
         * @type {string|ParsedToken} 
         */
        this.verb = '';

        /** The arguments to pass to the command */
        this.args = [];

        /** The text minus the verb */
        this.text = '';

        /** The original text of the command (whitespace and all) */
        this.original = '';

        /** @type {CommandShellOptions} */
        this.options = {};

        /**
         * Conditional command to execute if this command FAILS
         * @type {ParsedCommand}
         */
        this.alternate;

        /** 
         * Conditional command to execute if this one SUCCEEDS
         * @type {ParsedCommand} 
         */
        this.conditional;

        /**
         * Composite command 
         * @type {ParsedCommand}
         */
        this.nextCommand;

        /**
         * The command to pipe output to.
         * @type {ParsedCommand}
         */
        this.pipeTarget;

        /**
         * The last command parsed
         * @type {ParsedCommand}
         */
        this.previous;

        /** @type {ParsedToken[]} */
        this.tokens = [];
    }

    /** 
     * @returns {ParsedCommand} 
     */
    compile() {
        if (typeof this.verb === 'object') {
            if (this.verb.tokenType === TOKEN_ALIAS) {
                let template = this.verb.tokenValue,
                    variables = template.split(/(\$[0-9*]+)/)
                        .where(t => t.startsWith('$'))
                        .orderByDescending();

                variables.forEach(expr => {
                    if (expr.startsWith('$*')) {
                        let replacement = this.tokens
                            .select(t => t.tokenValue)
                            .join('')
                            .trim();
                        template = template.replace(expr, replacement);
                        this.tokens = []; // used up all remaining tokens
                    }
                    else if (/^\$[\d]+/.test(expr)) {
                        //  Get the nTh non-whitespace token
                        let n = parseInt(expr.slice(1)) - 1,
                            valueToken = this.tokens
                                .where(t => t.tokenType !== TOKEN_WHITESPACE)
                                .skip(n)
                                .firstOrDefault(),
                            replacement = valueToken ? valueToken.tokenValue : '';
                        template = template.replace(expr, replacement);
                        valueToken.tokenValue = '';
                    }
                });

                if (this.tokens.length) 
                    template = template.trim() + ' ' + this.tokens.select(s => s.length).join('').trim();

                this.original = template;
                this.verb = template.slice(0, template.search(/[^a-zA-Z0-9]/));
                this.text = template.slice(this.verb.length).trim();
                this.args = this.text.split(/\s+/);
            }
        }
        return this;
    }

    /** @type {ParsedToken} */
    get lastToken() {
        return this.tokens[this.tokens.length - 1] || {};
    }
}

class ParsedToken {
    constructor(start) {
        this.start = start;
        this.end = -1;
        this.source = '';
        this.complete = false;
        this.tokenType = TOKEN_WORD;
        this.tokenValue = '';
    }

    done(endIndex = false, start = -1) {
        if (typeof endIndex === 'number')
            this.end = endIndex;
        if (start > -1)
            this.start = start;
        this.complete = true;
        return this;
    }

    toString() {
        return `ParsedToken(type=${this.tokenType}, tokenValue=${this.tokenValue})`;
    }
}

class CommandParser {
    /**
     * Construct a new command parser.
     */
    constructor() {
        this.source = '';
        this.index = 0;

        /** @type {ParsedCommand[]} */
        this.commands = [];

        /** @type {CommandShellOptions} */
        this.options = {};
    }

    /**
     * Return the next command
     * @returns {{ operator: string, command: ParsedCommand }} 
     */
    async nextCommand() {
        /** @type {ParsedCommand} */
        let cmd;
        /** @type {ParsedToken} */
        let token;

        while (token = this.nextToken(cmd)) {
            if (!cmd) {
                let verbLookup = false;

                /*
                 * Possible scenarios:
                 * (1) Normal command issued by user,
                 * (2) Command alias issued by user, e.g.: :grins,
                 * (3) Variable assignment, e.g.: $v = Get-Item -Path /,
                 * (4) Function call, e.g.: Math.max(1,2),
                 * (5) An expression, e.g.: 1 + 2 * 3
                 */
                switch (token.tokenType) {
                    case TOKEN_ALIAS:
                        //  Defer additional processing until the command is complete
                        cmd = new ParsedCommand();
                        cmd.verb = token;
                        verbLookup = token.tokenValue.slice(0, token.tokenValue.search(/[^a-zA-Z0-9_-]/));
                        break;

                    case TOKEN_NUMERIC:
                    case TOKEN_WORD:
                        cmd = new ParsedCommand();
                        cmd.verb = token.tokenValue;
                        verbLookup = token.tokenValue;
                        break;

                    case TOKEN_VARIABLE:
                        cmd = new ParsedCommand();
                        cmd.verb = token;
                        cmd.cmdType = CMD_EXPR;
                        break;

                    case TOKEN_WHITESPACE:
                        //  Ignore leading whitespace
                        break;

                    default:
                        if (token.tokenType !== TOKEN_WORD && token.tokenType !== TOKEN_ALIAS)
                            throw new Error(`-kmsh: Unexpected token ${token.tokenType} '${token.tokenValue}' found at position ${token.start}; Expected verb.`);
                }

                if (verbLookup) {
                    await driver.driverCallAsync('nextCommand', async ecc => {
                        let modifiers = await ecc.getShellOptionsAsync(verbLookup);


                        if (!cmd.cmdType) {
                            if (modifiers.allowObjectShell)
                                cmd.cmdType = CMD_SHELL;
                            else
                                cmd.cmdType = CMD_MUD;
                        }

                        //  Command updates options available to the next command (if any)
                        cmd.options = { ...this.options, ...modifiers };
                    });
                }
            }
            else {
                let lastToken = cmd.lastToken;

                if (token.tokenType === TOKEN_OPERATOR)
                    return { operator: token, command: cmd };
                else if (token.tokenType === TOKEN_WORD && lastToken.tokenType === TOKEN_WORD) {
                    lastToken.tokenValue += token.tokenValue;
                    lastToken.end = token.end;
                }
                else
                    cmd.tokens.push(token);
            }
        }
        return cmd && {
            command: cmd.compile(),
            operator: null
        };
    }

    /**
     * Shorthand for creating a token
     * @param {{ tokenType: number, tokenValue: any, end: number }} values
     */
    buildToken(values = {}) {
        let result = new ParsedToken(this.index);

        result.tokenType = values.tokenType || TOKEN_WORD;
        result.end = values.end || ++this.index;
        result.source = this.source.substring(result.start, result.end);
        result.tokenValue = values.tokenValue || result.source;
        result.complete = true;
        return result;
    }

    /**
     * Expand any history expressions
     * @returns {string} The string with any history occurences replaced.
     */
    expandHistory() {
        //  Look for unescaped 
        let pieces = this.source.split(/((?<!\\)\![^\s]+)/),
            history = this.options.history;

        if (!this.options.allowHistory || history.length === 0)
            return false;

        if (pieces.length > 1) {
            pieces = pieces.map(chunk => {
                if (chunk.charAt(0) !== '!')
                    return chunk;
                else {
                    let source = chunk.slice(1),
                        i = 0,
                        n = 0;

                    let take = (f, t) =>  {
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

                    let found = '',
                        search = '!',
                        index = -1;

                    if (take('!'))
                        found = history.last();
                    else if (take('%'))
                        found = history.keyword || '';
                    else {
                        let contains = take('?'),
                            searchBack = take('-');

                        search = take(/[^\s\:]+/);
                        index = parseInt(search),
                            found = false;

                        if (isNaN(index)) {
                            if (contains)
                                for (let it = history.entries(), item = null; !it.done();) {
                                    item = it.next();
                                    let n = item.value.indexOf(search)
                                    if (n > -1) {
                                        let args = efuns.input.splitArgs(found = item.value, true);
                                        for (let x = 0; x < args.length; x++) {
                                            if (args[x].indexOf(search) > -1) {
                                                history.keyword = args[x];
                                                break;
                                            }
                                        }
                                    }
                                }
                            else
                                for (let it = history.reverse().entries(), item = null; !it.done();) {
                                    item = it.next();
                                    let n = item.value.indexOf(search)
                                    if (n > -1) {
                                        let args = efuns.input.splitArgs(found = item.value, true);
                                        for (let x = 0; x < args.length; x++) {
                                            if (args[x].indexOf(search) > -1) {
                                                history.keyword = args[x];
                                                break;
                                            }
                                        }
                                    }
                                }
                        }
                        else if (index > 0) {
                            if (searchBack) {
                                found = history[history.length - index];
                            }
                            else
                                found = history[index - 1];
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
                                if (n > -1)
                                    found = found.slice(0, n);
                            }
                            else if (nc === 'p') {
                                printOnly = true;
                            }
                            //  remove the suffix
                            else if (nc === 'r') {
                                let n = found.lastIndexOf('.');
                                if (n > -1)
                                    found = found.slice(0, n);
                            }
                            //  removing leading path
                            else if (nc === 't') {
                                let n = found.lastIndexOf('/');
                                if (n > -1)
                                    found = found.slice(n + 1);
                            }
                            else
                                throw Error(`Unrecognized expression starting at position ${i - 1}`);
                        }
                    }
                    return found || '';
                }
            });

            this.source = pieces.join('');
            return true;
        }
        return false;
    }

    /**
     * Fetch the next token
     * @param {ParsedCommand} cmd The command being built
     * @returns {ParsedToken} The next token
     */
    nextToken(cmd) {
        try {
            const retoken = /^((?<number>\d+[.]{0,1}\d*|\d*[.]{0,1}\d+)|(?<word>[a-zA-Z0-9_]+)|(?<whitespace>[\s]+))/;

            let
                options = cmd && cmd.options || this.options,
                token = new ParsedToken(this.index),
                text = this.remainder;

            if (!text)
                return false;

            for (let i = this.index; !token.complete; i++) {
                let c = this.source.charAt(i);

                if (!cmd) {
                    //  History substitution support
                    if (options.allowHistory && c === '^') {
                        let middle = text.indexOf('^', i + 1),
                            end = middle > -1 && text.indexOf('^', middle + 1) || -1;

                        if (middle > -1 && end > -1) {
                            let searchFor = this.source.slice(1, middle),
                                replaceWith = this.source.slice(middle + 1, end),
                                commandText = options.history[options.history.length - 1];

                            commandText = commandText.replace(searchFor, replaceWith);
                            this.source = this.source.slice(0, i) + commandText + this.source.slice(end + 1);
                            return this.nextToken(cmd);
                        }
                    }

                    //  Special case check for XALIASES
                    if (options.allowAliases) {
                        let alias = options.aliases[`$${c}`];
                        if (alias) {
                            return this.buildToken({ tokenType: TOKEN_ALIAS, tokenValue: alias });
                        }
                    }
                }

            /** @type {RegExpExecArray} */
                let mt = retoken.exec(text) || { groups: {} };

                switch (true) {
                    case !!mt.groups.whitespace:
                        {
                            token.tokenValue = mt.groups.whitespace;
                            token.tokenType = TOKEN_WHITESPACE;
                            token.source = text.slice(0, token.tokenValue.length);

                            return token.done(this.index = token.start + token.tokenValue.length);
                        }
                        break;

                    case !!mt.groups.number:
                        {
                            token.tokenValue = mt.groups.number;
                            token.tokenType = TOKEN_NUMERIC;
                            token.source = text.slice(0, token.tokenValue.length);

                            return token.done(this.index = token.start + token.tokenValue.length);
                        }
                        break;

                    case !!mt.groups.word:
                        {
                            token.tokenValue = mt.groups.word;
                            token.tokenType = TOKEN_WORD;
                            token.source = text.slice(0, token.tokenValue.length);

                            if (!cmd && options.allowAliases) {
                                let alias = options.aliases[token.tokenValue];
                                if (alias) {
                                    token.tokenValue = alias;
                                    token.tokenType = TOKEN_ALIAS;
                                }
                            }

                            return token.done(this.index = token.start + token.tokenValue.length);
                        }
                        break;

                    // Looks like a variable
                    case c === '$':
                        if (options.allowEnvironment) {
                            this.index = ++i;
                            let varName = this.nextToken();

                            token.tokenType = TOKEN_VARIABLE;
                            token.tokenValue = '$' + varName.tokenValue;
                            token.source = text.slice(0, token.tokenValue.length);

                            return token.done(varName.end);
                        }
                        else
                            return this.buildToken({ tokenValue: c });
                        break;

                    case c === '.':
                        //  Period could be a period in a sentence or it could be 
                        //  a property or method call on a variable...
                        if (options.allowObjectShell) {

                        }
                        else
                            return this.buildToken({ tokenValue: c });

                        break;

                    case c === '=':
                        //  The only time this character has special meaning is in
                        //  a variable assignment operation
                        if (options.allowObjectShell) {

                        }
                        else
                            return this.buildToken({ tokenValue: c });
                        break;

                    case c === '|':
                        if (options.allowPipelining) {
                            if (text.charAt(1) === '|') {
                                token.tokenType = TOKEN_OPERATOR;
                                token.source = token.tokenValue = OP_OR;
                                token.start = i;
                                return token.done(this.index = i += 2);
                            }
                            else {
                                token.tokenType = TOKEN_OPERATOR;
                                token.source = token.tokenValue = OP_PIPELINE;
                                token.start = i;
                                return token.done(this.index = ++i);
                            }
                        }
                        else
                            return this.buildToken({ tokenValue: c });

                    case c === '&':
                        if (options.allowPipelining) {
                            if (text.charAt(1) === '&') {
                                token.tokenType = TOKEN_OPERATOR;
                                token.source = token.tokenValue = OP_AND;
                                token.start = i;
                                return token.done(this.index = i += 2);
                            }
                            else {
                                token.tokenType = TOKEN_OPERATOR;
                                token.source = token.tokenValue = OP_BACKGROUND;
                                token.start = i;
                                return token.done(this.index = ++i);
                            }
                        }
                        else
                            return this.buildToken({ tokenValue: c });

                    case c === '\'':
                    case c === '\"':
                        {
                            let r = new RegExp(`([^\\\\]{1}\\${c})`);
                            let parts = text.split(r);

                            // look for the end of the string
                            let n = text.slice(1).search(r);

                            token.tokenValue = text.slice(1, n + 2);
                            token.source = text.slice(0, n + 3);
                            token.tokenType = TOKEN_STRING;

                            return token.done(this.index = i + token.tokenValue.length + 2);
                        }
                        break;

                    default:
                        return this.buildToken({ tokenValue: c });
                }
            }
        }
        catch (err) {
            console.log('Error parsing: ' + err.message);
        }
    }

    /**
     * Parse input text
     * @param {string} input
     * @param {CommandShellOptions} options
     */
    async parse(input, options) {
        /** @type {{ command: ParsedCommand, operator: ParsedToken }} */ 
        let result;
        /** @type{ParsedCommand} */
        let first;
        /** @type {ParsedCommand} */
        let prev;

        this.commands = [];
        this.source = input;
        this.index = 0;
        this.max = input.length;
        this.options = options || {};

        this.expandHistory();

        while (result = await this.nextCommand()) {
            if (!first)
                first = result.command;

            result.previous = prev;

            if (result.operator) {
                switch (result.operator) {
                    case OP_AND:
                        {
                            prev.conditional = result.command;
                            prev = result.command;
                        }
                        break;

                    case OP_ASSIGNMENT:
                        break;

                    case OP_COMPOUND:
                        {
                            prev.nextCommand = result.command;
                            prev = result.command;
                        }
                        break;

                    case OP_OR:
                        {
                            //  If any part of a && statement fails this alternate will execute
                            let p = prev;
                            while (p) {
                                p.alternate = result.command;
                                p = p.previous && p.previous.conditional;
                            }
                            prev.alternate = result.command;
                            prev = result.command;
                        }
                        break;

                    case OP_PIPELINE:
                        prev.pipeTarget = result.command;
                        prev = result.command;
                        break;
                }
            }
        }
        return first;
    }

    get remainder() {
        return this.source.slice(this.index);
    }
}

module.exports = CommandParser;
