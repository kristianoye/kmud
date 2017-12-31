/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Provides line editor support for non-browser clients.
 */
const
    DriverFeature = require('../config/DriverFeature'),
    ConfigUtil = require('../ConfigUtil'),
    EFUNProxy = require('../EFUNProxy'),
    FeatureBase = require('./FeatureBase'),
    MUDData = require('../MUDData'),
    MUDObject = require('../MUDObject'),
    MUDStorage = require('../MUDStorage'),
    MODE_INPUT = 1,
    MODE_COMMAND = 2,
    ParseEditorCommand = /^([0-9,]*)([a-zA-Z\/=\?]{0,1})([0-9,]*)(.*)/,
    ERROR_FAILED = 'Failed command',
    ERROR_NORANGE = 'Cannot use ranges with that command.',
    ERROR_SYNTAX = 'Bad command syntax.',
    SEARCH_FORWARD = 1,
    SEARCH_BACKWARD = 2;

const
    beautify = require('js-beautify').js_beautify;

const
    HelpText = `
        Help for Ed(itor)  [Version 1.0]
---------------------------------------------------------------------
        by Kriton [30 December 2017]

Commands:
/       search forward for pattern
?       search backward for a pattern
=       show current line number
a       append text starting after this line
A       like 'a' but with inverse autoindent mode
c       change current line, query for replacement text
d       delete line(s)
e       replace this file with another file
E       same as 'e' but works if file has been modified
f       show/change current file name
g       Search and execute command on any matching line.
h       help file (display this message)
i       insert text starting before this line
I       indent the entire code (Qixx version 1.0)
j       join lines together
k       mark this line with a character - later referenced as 'a
l       list line(s) with control characters displayed
m       move line(s) to specified line
n       toggle line numbering
O       same as 'i'
o       same as 'a'
p       print line(s) in range
q       quit editor
Q       quit editor even if file modified and not saved
r       read file into editor at end of file or behind the given line
s       search and replace
set     query, change or save option settings
t       move copy of line(s) to specified line
v       Search and execute command on any non-matching line.
x       save file and quit
w       write to current file (or specified file)
W       like the 'w' command but appends instead
z       display 19 lines, possible args are . + - --
Z       display 24 lines, possible args are . + - --
`;
    
class EditorInstance {
    /**
     * Create an editor instance
     * @param {Object.<string,any>} options
     */
    constructor(options) {
        /** @type {string[]} */
        this.buffer = [];

        this.caps = options.caps || false;

        /** @type {string[]} */
        this.content = options.content || [];

        /** @type {number} */
        this.currentLine = options.startLine || 0;

        /** @type {boolean} */
        this.dirty = false;

        /** @type {EFUNProxy} */
        this.efuns = options.efuns;

        /** @type {string} */
        this.filename = options.filename || '##tmp##';

        /** @type {number} */
        this.height = options.height || 18;

        /** @type {number} */
        this.mode = options.mode || MODE_INPUT;

        /** @type {function} */
        this.onComplete = function () { };

        /** @type {MUDObject} */
        this.owner = options.owner;

        //  Number of lines reserved for editor prompt, etc, at bottom of screen.
        /** @type {number} */
        this.reserveLines = options.reserveLines || 2;

        /** @type {boolean} */
        this.restricted = options.resticted;

        /** @type {RegExp} */
        this.searchExpression = false;

        /** @type {boolean} */
        this.showLineNumbers = options.showLineNumbers || false;

        /** @type {number} */
        this.width = options.width || 80;

        if (this.caps) {
            this.caps.on('kmud', evt => {
                switch (evt.eventType) {
                    case 'disconnect':
                        // TODO: Save to deadedit file
                        break;

                    case 'windowSize':
                        this.height = evt.eventData.height;
                        this.width = evt.eventData.width;
                        break;
                }
            });
        }
    }

    /**
     * Append at the specified position
     * @param {string[]} lines The lines to append.
     * @param {number} pos The index at which to insert the buffer.
     */
    appendBuffer(lines, pos) {
        this.content = this.content.slice(0, pos || this.currentLine).concat(lines, this.content.slice(pos || this.currentLine));
        this.currentLine = (pos || this.currentLine) + lines.length;
        this.buffer = [];
    }

    /**
     * Copy lines
     * @param {number|number[]} range
     * @param {number=} pos
     */
    copyLines(range, pos) {
        this.appendBuffer(this.content.slice(range[0], range[1]), pos);
    }

    /**
     * Delete a range of lines.
     * @param {number|number[]} range
     */
    deleteRange(range) {
        if (Array.isArray(range)) {
            this.content = this.content.slice(0, range[0]).concat(this.content.slice(range[1]));
        }
        else {
            this.content = this.content.slice(0, range).concat(this.content.slice(range + 1));
        }
        this.dirty = true;
    }

    /**
     * Process an editor command.
     * @param {string} cmd
     * @param {number[]=} range
     * @returns {string}
     */
    executeCommand(cmd, range) {
        if (this.mode === MODE_INPUT) {
            if (cmd === '.') {
                if (this.buffer.length > 0) this.dirty = true;
                this.appendBuffer(this.buffer);
                this.mode = MODE_COMMAND;
            }
            else if (cmd === '!') {
                return cmd.slice(1);
            }
            else {
                this.buffer.push(cmd);
            }
        }
        else {
            let tokens = ParseEditorCommand.exec(cmd);

            if (tokens) {
                let command = tokens[2] || 'p',
                    rangeLeft = this.parseRange(tokens[1]),
                    rangeRight = this.parseRange(tokens[3]);

                if (rangeLeft === false)
                    rangeLeft = this.currentLine;

                switch (command) {
                    case '/':
                        return this.search(SEARCH_FORWARD, tokens.slice(3).join(''));

                    case '?':
                        return this.search(SEARCH_BACKWARD, tokens.slice(3).join(''));

                    case '=':
                        return this.print(`Current line: ${(this.currentLine + 1)}`);

                    case '/':
                        break;
                    case 'a': case 'o':
                        if (Array.isArray(rangeLeft))
                            return this.print(ERROR_NORANGE);
                        else if (rangeRight)
                            return this.print(ERROR_SYNTAX);
                        this.currentLine = rangeLeft + 1;
                        this.mode = MODE_INPUT;
                        return;

                    case 'd':
                        if (rangeRight)
                            return this.print(ERROR_SYNTAX);
                        return this.deleteRange(rangeLeft);

                    case 'h':
                        return this.showHelp(tokens.slice(3).join(''));

                    case 'i': case 'O':
                        if (Array.isArray(rangeLeft))
                            return this.print(ERROR_NORANGE);
                        else if (rangeRight)
                            return this.print(ERROR_SYNTAX);
                        this.currentLine = rangeLeft;
                        this.mode = MODE_INPUT;
                        return;

                    case 'I':
                        return this.indentCode();

                    case 'n':
                        if (rangeRight)
                            return this.print(ERROR_SYNTAX);
                        this.showLineNumbers = !this.showLineNumbers;
                        return this.print(`Line numbers are ${(this.showLineNumbers ? 'on' : 'off')}`);

                    case 'p':
                        if (rangeRight)
                            return this.print(ERROR_SYNTAX);
                        if (Array.isArray(rangeLeft))
                            return this.printLines(rangeLeft[0], rangeLeft[1]);
                        else
                            return this.printLines(rangeLeft, 1);

                    case 'q':
                        if (this.dirty) {
                            return this.print(`Type 'Q' to exit editor without saving.`);
                        }
                        return this.onComplete();

                    case 'Q':
                        return this.onComplete();

                    case 't':
                        // 1,2t  or 1,2t1
                        if (Array.isArray(rangeRight))
                            return this.print(ERROR_SYNTAX);
                        else if (Array.isArray(rangeLeft))
                            return this.copyLines(rangeLeft, rangeRight || this.currentLine);
                        else
                            return this.copyLines([rangeLeft, rangeLeft+1], (rangeRight || this.currentLine - 1));

                    case 'w':
                        this.dirty = false;
                        break;

                    case 'z':
                        if (Array.isArray(rangeLeft))
                            return this.printLines(rangeLeft[0], 19);
                        else
                            return this.printLines(rangeLeft, 19);

                    case 'Z':
                        if (Array.isArray(rangeLeft))
                            return this.printLines(rangeLeft[0], this.height - this.reserveLines);
                        else
                            return this.printLines(rangeLeft, this.height - this.reserveLines);
                }
            }
            return this.print('Unrecognized command.');
        }
    }

    /**
     * Format a line number for display.
     * @param {number} n
     */
    formatLineNumber(n) {
        let s = n.toString(), p = 5 - s.length;
        return '  ' + s + Array(p).join(' ');
    }

    /**
     * Format the code.
     */
    indentCode() {
        try {
            this.content = beautify(this.content.join('\n'),
                { indent_size: 2 })
                .split('\n');
            this.dirty = true;
            return this.print('Formatting complete.');
        }
        catch (err) {
            this.print(`Formatting failure: ${err.message}`)
        }
    }

    /**
     * Loads a file into the editor.
     * @param {string} filename The file to read
     * @param {number=} pos the position to set after the file is appended.
     */
    loadFile(filename, pos) {
        try {
            if (this.efuns.isFile(filename)) {
                this.appendBuffer(this.efuns.readFile(filename).split('\n'));
                this.currentLine = 1;
            }
        }
        catch (err) {
            this.print(`Unable to read file '${filename}'`);
        }
    }

    /**
     * Parse a string into a line number or range.
     * @param {string} str The token to parse.
     * @returns {number[]|number} A single line number or a range.
     */
    parseRange(str) {
        if (!str || str.length === 0) return false;
        let parts = str.split(',', 2).map(s => parseInt(s) - 1);
        return parts.length === 2 ? [parts[0], parts[1]+1] : parts[0];
    }

    /**
     * Print text to the user.
     * @param {...string[]} str The message to print to the user.
     */
    print(...str) {
        return this.owner.writeLine(str.join('\n'));
    }

    /**
     * Print a line range
     * @param {number} start The line to start printing from
     * @param {number} lineCount The number of lines to try and print.
     */
    printLines(start, lineCount) {
        let page = this.content.slice(start, start + lineCount);
        if (page.length === 0) {
            this.currentLine = this.content.length;
            return this.print('At end of file.');
        }
        else if (this.showLineNumbers) {

            this.print(page.map((line, n) => `${this.formatLineNumber(n + start + 1)}  ${line}`).join('\n'));
        }
        else {
            this.print(page.join('\n'));
        }
        this.currentLine = start + page.length;
    }

    /**
     * Query the state of the editor.
     * @param {object=} state
     */
    queryState(state) {
        let result = 0;

        if (this.mode === MODE_INPUT) 
            result = this.currentLine + 1;

        if (typeof state === 'object') {
            state.line = this.currentLine + 1 + this.buffer.length;
            state.lineTotal = this.content.length;
            state.dirty = this.dirty;
            state.filename = this.filename;
            state.showLineNumbers = this.showLineNumbers;
        }
        return result;
    }

    /**
     * Search for the specified pattern.
     * @param {number} dir
     * @param {string} term
     */
    search(dir, term) {
        if (term && term.length > 0)
            this.searchExpression = new RegExp(term);

        if (!this.searchExpression)
            return this.print(ERROR_FAILED);

        if (dir === SEARCH_FORWARD) {
            for (let i = this.currentLine, max = this.content.length; i < max; i++) {
                if (this.content[i].match(this.searchExpression)) {
                    this.currentLine = i;
                    return this.printLines(this.currentLine, 1);
                }
            }
        } else {
            for (let i = this.currentLine-2; i > -1; i--) {
                if (this.content[i].match(this.searchExpression)) {
                    this.currentLine = i;
                    return this.printLines(this.currentLine, 1);
                }
            }
        }
        return this.print(`Search failed: ${this.searchExpression}`);
    }

    /**
     * Display help to the user.
     * @param {string=} topic The optional specific topic  to search for.
     */
    showHelp(topic) {
        if (!topic) {
            this.print(HelpText);
        }
        switch (topic) {
            case '/':
                return this.print(
                    'Command: /',
                    'Usage: /[pattern]\n',
                    '\tSearches the remaining lines in the file for the specified regular expression pattern.',
                    '\tIf no pattern is specified it will use the last search expression [if set]');

            case '?':
                return this.print(
                    'Command: ?',
                    'Usage: ?[pattern]\n',
                    '\tSearches the previous lines in the file for the specified regular expression pattern.',
                    '\tIf no pattern is specified it will use the last search expression [if set]');

            case '=':
                return this.print(
                    'Command: =',
                    'Usage: =\n',
                    '\tPrints the current line number.');

            case 'a':
                return this.print(
                    'Command: a [append]',
                    'Usage: a or <line #>a\n',
                    '\tWill put editor into append mode after the current or specified line.');

            case 'i':
                return this.print(
                    'Command: i [append]',
                    'Usage: i or <line #>i\n',
                    '\tWill put editor into input mode at the current or specified line.');

            case 'I':
                return this.print(
                    'Command: I [format code]',
                    'Usage: I\n',
                    '\tAttempts to format the code [this only works on Javascript code at the moment].');

            case 'q':
                return this.print(
                    'Command: q [quit]',
                    'Usage: q\n',
                    '\tWill exit the editor provided there are no pending changes.');

            case 'Q':
                return this.print(
                    'Command: q [force quit]',
                    'Usage: q\n',
                    '\tWill discard any unsaved changes and exit the editor.');

            default:
                return this.print(`Help topic '${topic}' not found.`);
        }
    }

    start(completed) {
        this.onComplete = completed;
    }
}

/**
 * @returns {EditorInstance}
 */
EditorInstance.get = function (ob) {
    let $storage = MUDStorage.get(ob);
    return $storage && $storage.getProtected('$editor');
};

class MUDEditorFeature extends FeatureBase {
    /**
     * @param {DriverFeature} config Config data
     * @param {Object.<string,boolean>} flags Flags indicating what features are available.
     */
    constructor(config, flags) {
        super(config, flags);

        if (config.parameters.enableOldEditor === true) {
            this.enableOldEditor = true;
            this.efunNameEd = config.parameters.efunNameEd || 'ed';
        }
        else {
            this.enableOldEditor = false;
            this.efunNameEd = false;
            this.efunNameEdStart = config.parameters.efunNameEdStart || 'editorStart';
            this.efunNameEdCommand = config.parameters.efunNameEdCommand || 'editorCmd';
            this.efunNameQueryEdMode = config.parameters.efunNameQueryEdMode || 'queryEditorMode';
            this.lineNumberPadding = config.parameters.lineNumberPadding || 5;
            this.maxFileSize = config.parameters.maxFileSize || 500 * 1024;
        }
        flags.editor = true;
    }

    assertValid() {
        ConfigUtil.assertType(this.maxFileSize, 'maxFileSize', 'number');
        ConfigUtil.assertType(this.lineNumberPadding, 'lineNumberPadding', 'number');
        ConfigUtil.assertType(this.enableOldEditor, 'enableOldEditor', 'boolean');
        if (this.enableOldEditor) {
            ConfigUtil.assertType(this.efunNameEd, 'efunNameEd', 'string');
        }
        else {
            ConfigUtil.assertType(this.efunNameEdCommand, 'efunNameEdCommand', 'string');
            ConfigUtil.assertType(this.efunNameEdStart, 'efunNameEdStart', 'string');
            ConfigUtil.assertType(this.efunNameQueryEdMode, 'efunNameQueryEdMode', 'string');
        }
    }

    createExternalFunctions(efunPrototype) {
        let feature = this;

        if (this.enableOldEditor) {
            efunPrototype[this.efunNameEd] = function (filename) {

            };
        }
        else {
            efunPrototype[this.efunNameEdCommand] = function (cmd) {
                let thisObject = this.thisObject(),
                    $editor = EditorInstance.get(thisObject);

                return $editor ? $editor.executeCommand(cmd) : false;
            };

            efunPrototype[this.efunNameEdStart] = function (/** @type {string=} */ file, /** @type {boolean=} */ restricted, /** @type {Object.<string,any>} */ optionsIn) {
                let editorState = this[feature.efunNameQueryEdMode].call(this);
                if (editorState === -1) {
                    let thisEditor = this.thisPlayer(),
                        $storage = MUDStorage.get(thisEditor),
                        caps = $storage.getClientCaps(),
                        options = optionsIn || {};

                    options.caps = caps;
                    options.efuns = this;
                    options.filename = file && file.length > 0 ? file : false;
                    options.owner = thisEditor;
                    options.height = caps && caps.clientHeight || 24;
                    options.width = caps && caps.clientWidth || 80;
                    options.restricted = restricted || options.restricted || false;

                    let $editor = new EditorInstance(options);

                    if (options.filename) {
                        $editor.loadFile(options.filename);
                        options.mode = MODE_COMMAND;
                    }
                    else if (options.content) {
                        if (!Array.isArray(options.content)) {
                            $editor.appendBuffer(options.content.split('\n'));
                        }
                        else 
                            $editor.append(options.content);
                    }
                    $storage.setProtected('$editor', $editor);
                    $editor.start(() => {
                        $storage.setProtected('$editor', false);
                    });
                }
                return false;
            };

            efunPrototype[this.efunNameQueryEdMode] = function (state) {
                let thisEditor = this.thisPlayer(),
                    $editor = EditorInstance.get(thisEditor);

                return $editor ? $editor.queryState(state) : -1;
            };
        }
    }
}

module.exports = MUDEditorFeature;
