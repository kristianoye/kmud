/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017-2020.  All rights reserved.
 * Date: October 6, 2020
 *
 * Description: Parser that splits a commandline into a command tree.
 */

const CommandShellOptions = require("./CommandShellOptions");

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
    retoken = /^((?<number>\d+[.]{0,1}\d*|\d*[.]{0,1}\d+)|(?<word>[a-zA-Z0-9_]+)|(?<whitespace>[\s]+))/,
    rehistory = /^!(?<lookup>(?<last>[!])|(?<number>[-]\d+)|(?<search>[^\s\d:][\w]+)){0,1}(?<param>:(?:\d+|\^|\$|\*)){0,1}/,
    rehistoryModifiers = /^(?<modifier>(?<arg>:(?:\d+|[\^\$\*]{1})|(?<replace>:s\/(?<term>[^\/]+)\/(?<replacement>[^\/]+)\/))|(?<mods>[htrp]))/g;

const
    OP_AND = '&&',
    OP_ASSIGNMENT = '=',
    OP_BACKGROUND = '&',
    OP_COMPOUND = ';',
    OP_OR = '||',
    OP_PIPEBOTH = '|&',
    OP_PIPELINE = '|',
    OP_READSTDIN = '<',
    OP_APPENDOUT = '>>',
    OP_WRITEOUT = '>';

const
    TOKEN_ALIAS = 'Alias',
    TOKEN_HISTORY = 'History',
    TOKEN_HISTORYSUB = 'HistorySubstitution',
    TOKEN_MEMBERACCESS = 'MemberAccess',
    TOKEN_NUMERIC = 'Numeric',
    TOKEN_OPERATOR = 'Operator',
    TOKEN_STRING = 'String',
    TOKEN_VARIABLE = 'Variable',
    TOKEN_WHITESPACE = 'Whitespace',
    TOKEN_WORD = 'Word',
    TOKEN_BACKTICK = 'Backtick',
    TokenTypes = {
        TOKEN_ALIAS,
        TOKEN_BACKTICK,
        TOKEN_HISTORY,
        TOKEN_NUMERIC,
        TOKEN_OPERATOR,
        TOKEN_STRING,
        TOKEN_VARIABLE,
        TOKEN_WHITESPACE,
        TOKEN_WORD
    };

class ParsedCommand {
    constructor(options = {}) {
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
        this.options = options;

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

        this.operator = '';

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
     * Append a token to the command
     * @param {ParsedToken} token
     */
    addToken(token) {
        token.index = this.tokens.length;
        this.tokens.push(token);
    }

    /** 
     * @returns {ParsedCommand} 
     */
    compile() {
        if (typeof this.verb === 'object') {
            if (this.verb.tokenType === TOKEN_ALIAS) {
                let template = this.verb.tokenValue,
                    variables = template.split(/(\$(?:\*|[0-9]+))/)
                        .filter(t => t.startsWith('$'))
                        .map(t => {
                            let n = parseInt(t.slice(1));
                            return isNaN(n) ? -1 : n - 1;
                        })
                        .sort((a, b) => { a > b ? -1 : 1 }),
                    tokens = this.tokens
                        .filter(t => t.tokenType !== TokenTypes.TOKEN_WHITESPACE)
                        .map(t => t.tokenValue)
                        .slice(0);

                variables.forEach(n => {
                    let expr = n === -1 ? '$*' : `$${(n + 1)}`;
                    if (expr === '$*') {
                        let replacement = tokens
                            .join('')
                            .trim();
                        template = template.replace(expr, replacement);
                        tokens = tokens.map(t => '');
                    }
                    else if (/^\$[\d]+/.test(expr)) {
                        template = template.replace(expr, tokens[n]);
                        tokens[n] = '';
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

    expandVariable(name) {
        if (name in this.options.variables) {
            let val = this.options.variables[name];
            if (typeof val === 'string')
                return val;
            else if (typeof val === 'function')
                return val();
            else
                return val.toString();
        }
    }

    /** @type {ParsedToken} */
    get lastToken() {
        return this.tokens[this.tokens.length - 1] || {};
    }

    /**
     * Convert this command into a value that can be stored in history
     * @returns {string}
     */
    toHistoryString() {
        let result = this.leadingWhitespace && this.leadingWhitespace.source || '',
            nextCommand = this.conditional || this.alternate || this.nextCommand || this.pipeTarget,
            operator = this.operator;

        result += this.verb + this.tokens.map(t => t.source).join('')
        if (operator) {
            result += operator;
            if (nextCommand) {
                result += nextCommand.toHistoryString();
            }
        }
        return result;
    }
}

class ParsedToken {
    constructor(start) {
        this.start = start;
        this.end = -1;
        this.index = -1;
        this.source = '';
        this.complete = false;
        this.tokenType = TOKEN_WORD;
        this.tokenValue = '';
    }

    /**
     * Combine two tokens
     * @param {CommandParser} parser The parser doing the work
     * @param {ParsedToken} token The token being appended
     */
    appendToken(parser, token) {
        this.tokenValue += token.tokenValue;
        this.end = token.end;
        this.source = parser.source.slice(this.start, token.end);
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
     * @param {string} source The source to parse
     */
    constructor(source, shell = false) {
        this.source = source || '';
        this.index = 0;

        /** @type {CommandShellOptions} */
        this.options = shell && shell.options || {};
        this.commandCount = 0;
        this.shell = shell;
        /** @type {ParsedToken[]} */
        this.tokenStack = [];
    }

    /**
     * Return the next command
     * @returns {{ operator: ParsedToken, command: ParsedCommand }} 
     */
    async nextCommand() {
        /** @type {ParsedCommand} */
        let cmd;

        /** @type {ParsedToken} */
        let token;

        while (token = await this.nextToken(cmd)) {
            if (!cmd) {
                let verbLookup = false;

                switch (token.tokenType) {
                    case TOKEN_ALIAS:
                        //  Defer additional processing until the command is completely parsed.
                        cmd = new ParsedCommand();
                        verbLookup = token.tokenValue.slice(0, token.tokenValue.search(/[^a-zA-Z0-9_-]/));
                        cmd.verb = token;
                        break;

                    case TOKEN_HISTORY:
                        this.source = this.source.slice(0, token.start) + token.tokenValue + this.source.slice(token.end);
                        this.index = token.start;
                        continue;

                    case TOKEN_NUMERIC:
                    case TOKEN_WORD:
                        {
                            cmd = new ParsedCommand();
                            let nextToken = await this.nextToken(cmd);
                            while (nextToken) {
                                if (nextToken.tokenType === TOKEN_WHITESPACE) {
                                    this.tokenStack.unshift(nextToken);
                                    break;
                                }
                                else {
                                    token.appendToken(this, nextToken);
                                    nextToken = await this.nextToken(cmd);
                                }
                            }
                            cmd.verb = token.tokenValue;
                            verbLookup = token.tokenValue;
                        }
                        break;

                    case TOKEN_VARIABLE:
                        cmd = new ParsedCommand();
                        cmd.verb = token;
                        cmd.cmdType = CMD_EXPR;
                        break;

                    case TOKEN_WHITESPACE:
                        //  Ignore leading whitespace
                        this.leadingWhitespace = token;
                        break;

                    default:
                        if (token.tokenType !== TOKEN_WORD && token.tokenType !== TOKEN_ALIAS)
                            throw new Error(`-kmsh: Unexpected token ${token.tokenType} '${token.tokenValue}' found at position ${token.start}; Expected verb.`);
                }

                if (cmd && this.leadingWhitespace) {
                    cmd.leadingWhitespace = this.leadingWhitespace;
                    delete this.leadingWhitespace;
                }

                if (verbLookup && this.shell) {
                    let options = await this.shell.getShellSettings(verbLookup, new CommandShellOptions());
                    cmd.options = options;
                }
            }
            else {
                let lastToken = cmd.lastToken;

                if (token.tokenType === TOKEN_OPERATOR) {
                    switch (token.tokenValue) {
                        case OP_READSTDIN:
                            {
                                cmd.addToken(token);
                                let filename = await this.nextCompleteWord(cmd);
                                if (!filename)
                                    throw new Error(`-kmsh: Syntax error while searching for expected input file`);
                                token.fileToken = filename.index;
                                token.fileName = filename.source;
                            }
                            break;

                        case OP_APPENDOUT:
                        case OP_WRITEOUT:
                            {
                                cmd.addToken(token);
                                let filename = await this.nextCompleteWord(cmd);
                                if (!filename)
                                    throw new Error(`-kmsh: Syntax error while searching for expected output file`);
                                token.fileToken = filename.index;
                                token.fileName = filename.source;
                            }
                            break;

                        default:
                            return { operator: token, command: cmd };
                    }
                }
                else if (token.tokenType === TOKEN_WORD && lastToken.tokenType === TOKEN_WORD) {
                    lastToken.appendToken(this, token);
                }
                else if (lastToken.tokenType === TOKEN_WORD) {
                    //switch (lastToken.tokenValue) {
                    //}
                    cmd.addToken(token);
                }
                else {
                    cmd.addToken(token);
                }
            }
        }
        return cmd && {
            command: cmd.compile(),
            operator: null
        } || { cmd: false, operator: null };
;
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
     * Fetch the next complete word
     * @param {ParsedCommand} cmd The command being built
     * @returns {ParsedToken} The next token
     */
    async nextCompleteWord(cmd) {
        let nextToken = await this.nextToken(cmd),
            wordToken = false;

        while (nextToken && !wordToken) {
            if (nextToken.tokenType === TOKEN_WORD) {
                if (!wordToken)
                    wordToken = nextToken;

                nextToken = await this.nextToken(cmd);

                while (nextToken.tokenType === TOKEN_WORD) {
                    wordToken.tokenValue += nextToken.tokenValue;
                    wordToken.end = nextToken.end;
                    nextToken = await this.nextToken(cmd);
                }
                wordToken.source = this.source.slice(wordToken.start, wordToken.end);
                cmd.addToken(wordToken);
                if (nextToken) cmd.addToken(nextToken);
                return wordToken;
            }
            else
                cmd.addToken(nextToken);
            nextToken = await this.nextToken(cmd);
        }
        return wordToken;
    }

    /**
     * Fetch the next token
     * @param {ParsedCommand} cmd The command being built
     * @returns {ParsedToken} The next token
     */
    async nextToken(cmd) {
        try {
            if (this.tokenStack.length)
                return this.tokenStack.shift();

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
                        let parts = text.split('^');

                        if (parts.length === 4 && parts[1].length > 0) {
                            let searchFor = this.source.slice(1, middle),
                                replaceWith = this.source.slice(middle + 1, end),
                                commandText = options.history[options.history.length - 1];

                            commandText = commandText.replace(searchFor, replaceWith);
                            this.source = this.source.slice(0, i) + commandText + this.source.slice(end + 1);
                            return await this.nextToken(cmd);
                        }
                    }
                    //  Special case check for XALIASES
                    if (options.expandAliases) {
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

                            if (!cmd && options.expandAliases) {
                                let alias = options.aliases[token.tokenValue];
                                if (alias) {
                                    token.tokenValue = alias;
                                    token.tokenType = TOKEN_ALIAS;
                                }
                            }

                            return token.done(this.index = token.start + token.source.length);
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

                    case c === '<':
                        // Read file as stdin
                        if (options.allowFileIO) {
                            return this.buildToken({ tokenValue: c, tokenType: TOKEN_OPERATOR });
                        }
                        else
                            return this.buildToken({ tokenValue: c });

                    case c === '>':
                        if (options.allowFileIO) {
                            if (text.charAt(1) === '>') {
                                token.tokenType = TOKEN_OPERATOR;
                                token.source = token.tokenValue = OP_APPENDOUT;
                                token.start = i;
                                return token.done(this.index = i += 2);
                            }
                            else {
                                token.tokenType = TOKEN_OPERATOR;
                                token.source = token.tokenValue = OP_WRITEOUT;
                                token.start = i;
                                return token.done(this.index = ++i);
                            }
                        }
                        else
                            return this.buildToken({ tokenValue: c });

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

                    case c === ';':
                        if (options.allowPipelining) {
                            token.tokenType = TOKEN_OPERATOR;
                            token.source = token.tokenValue = OP_COMPOUND;
                            token.start = i;
                            return token.done(this.index = ++i);
                        }
                        else
                            return this.buildToken({ tokenValue: c });
                        break;

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

                            // look for the end of the string
                            let n = text.slice(1).search(r);

                            if (n === -1)
                                return this.buildToken({ tokenValue: c });

                            token.tokenValue = text.slice(1, n + 2);
                            token.source = text.slice(0, n + 3);
                            token.tokenType = TOKEN_STRING;
                            token.isLiteral = c === '\'';
                            if (options.preserveQuotes) {
                                token.tokenValue = token.source;
                                return token.done(this.index = i + token.tokenValue.length);
                            }
                            else
                                return token.done(this.index = i + token.tokenValue.length + 2);
                        }
                        break;

                    case c === '!':
                        {
                            let m = rehistory.exec(text),
                                history = options.history,
                                len = Array.isArray(history) ? history.length : -1,
                                entry = -1;

                            if (len === -1)
                                return this.buildToken({ tokenValue: c });
                            else if (m) {
                                if (m.groups.number) {
                                    let n = parseInt(m.groups.number);
                                    if (n < 0)
                                        entry = len + n - 1;
                                    else
                                        entry = n;
                                }
                                else if (m.groups.last) {
                                    entry = len - 1;
                                }
                                else if (m.groups.lookup) {
                                    for (let i = len - 1; i > -1; i--) {
                                        if (history[i].startsWith(m.groups.lookup)) {
                                            entry = i;
                                            break;
                                        }
                                    }
                                }
                                else
                                    entry = len - 1;

                                if (history[entry] === undefined)
                                    throw new Error(`-kmsh: ${m.groups.lookup}: Event not found`);

                                token.tokenType = TOKEN_HISTORY;
                                token.start = m.index;
                                token.end = m.index + m[0].length;
                                token.modifiers = [];
                                token.tokenValue = history[entry];

                                if (m.groups.param) {
                                    let values = token.tokenValue.split(/\s+/),
                                        pv = token.tokenValue.slice(1);
                                    if (pv === '*')
                                        token.tokenValue = values.join(' ');
                                    else if (pv === '^')
                                        token.tokenValue = values.shift();
                                    else if (pv === '$')
                                        token.tokenValue = values.pop();
                                    else {
                                        let n = parseInt(v);
                                        if (n < 0 || n > values.length)
                                            throw new Error(`-kmsh: ${m.groups.param}: Bad specifier`);
                                        token.tokenValue = values[n];
                                    }
                                }

                                let remainder = text.slice(token.end);
                                m = rehistoryModifiers.exec(remainder);

                                while (m) {
                                    token.modifiers.push(m[0]);
                                    remainder = remainder.slice(token.end = m.index + m[0].length);
                                    m = rehistoryModifiers.exec(remainder);
                                }
                                token.source = text.slice(token.start, token.end);
                                return this.buildToken(token);
                            }
                            else
                                return this.buildToken({ tokenValue: c });
                        }
                        break;

                    case c === '`':
                        {
                            if (options.expandBackticks === true) {
                                let r = new RegExp(`([^\\\\]{1}\\${c})`);
                                let parts = text.split(r);

                                // look for the end of the string
                                let n = text.slice(1).search(r);

                                token.tokenValue = text.slice(1, n + 2);
                                token.source = text.slice(0, n + 3);
                                token.tokenType = TOKEN_BACKTICK;

                                return token.done(this.index = i + token.tokenValue.length + 2);
                            }
                            else
                                return this.buildToken({ tokenValue: c });
                        }

                    case c === '\\':
                        {
                            if (options.allowEscaping) {
                                let nc = text.charAt(1);
                                if (nc) {
                                    token.tokenValue = c;
                                    token.source = text.slice(0, 2);
                                    token.tokenType = TOKEN_WORD;
                                    return token.done(this.index = i + 1);
                                }
                                throw new Error('-kmsh: Unexpected end of input');
                            }
                            else
                                return this.buildToken({ tokenValue: c });
                        }

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
     * Parse some text
     */
    async parse() {
        let { operator, command } = await this.nextCommand();

        if (!operator)
            return command;

        while (operator) {
            let { operator: nextOp, command: nextCmd } = await this.nextCommand();

            if (!operator)
                throw new Error(`-kmsh: Operator not followed by command`);

            command.operator = operator.tokenValue;

            switch (operator.tokenValue) {
                case OP_AND:
                    command.conditional = nextCmd;
                    break;

                case OP_COMPOUND:
                    shcommand.nextCommand = nextCmd;
                    break;

                case OP_OR:
                    command.alternate = nextCmd;
                    break;

                case OP_PIPELINE:
                    command.nextCommand = nextCmd;
                    command.stdout = {}; // TODO: Create stdout here
                    nextCmd.stdin = {}; //  TODO: Create reader for command.stdout
                    break;

                case OP_PIPEBOTH:
                    command.nextCommand = nextCmd;
                    command.stdout = {}; // TODO: Create stdout here
                    command.stderr = command.stdout;
                    nextCmd.stdin = {}; //  TODO: Create reader for command.stdout
                    break;

                default:
                    throw new Error(`-kmsh: Unsupported operator: ${operator}`);
            }

            operator = nextOp;
        }
        return command;
    }

    get remainder() {
        return this.source.slice(this.index);
    }

    /**
     * 
     * @param {ParsedToken} token
     */
    rewindToken(token) {
        if (token)
            this.index = token.start;
    }
}

module.exports = {
    CommandParser,
    ParsedCommand,
    TokenTypes
};

