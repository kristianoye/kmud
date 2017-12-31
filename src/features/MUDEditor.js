const
    DriverFeature = require('../config/DriverFeature'),
    ConfigUtil = require('../ConfigUtil'),
    EFUNProxy = require('../EFUNProxy'),
    FeatureBase = require('./FeatureBase'),
    MUDData = require('../MUDData'),
    MUDObject = require('../MUDObject'),
    MUDStorage = require('../MUDStorage'),
    MODE_INPUT = 0,
    MODE_COMMAND = 1,
    ParseEditorCommand = /^([0-9,]*)([a-zA-Z]*)(.*)$/,
    ERROR_NORANGE = 'Cannot use ranges with that command.',
    ERROR_SYNTAX = 'Bad command syntax.';

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

        /** @type {boolean} */
        this.showLineNumbers = options.showLineNumbers || false;

        /** @type {number} */
        this.width = options.width || 80;

        if (this.caps) {
            this.caps.on('kmud', evt => {
                switch (evt.eventType) {
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
     */
    appendBuffer(lines, atLine) {
        let newContent = new Array(), pos = atLine || this.currentLine;
        newContent = newContent.concat(this.content.slice(0, pos), lines, this.content.slice(pos));
        this.content = newContent;
        this.currentLine = pos + lines.length;
        this.buffer = [];
    }

    deleteRange(range) {
        if (Array.isArray(range)) {
            this.content = this.content.slice(0, range[0]).concat(this.content.slice(range[1] + 1));
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
                    case 'a': case 'o':
                        if (Array.isArray(rangeLeft))
                            return this.owner.writeLine(ERROR_NORANGE);
                        else if (rangeRight)
                            return this.owner.writeLine(ERROR_SYNTAX);
                        this.currentLine = rangeLeft + 1;
                        this.mode = MODE_INPUT;
                        return;

                    case 'd':
                        if (rangeRight)
                            return this.owner.writeLine(ERROR_SYNTAX);
                        return this.deleteRange(rangeLeft);

                    case 'h':
                        return this.owner.writeLine(HelpText);

                    case 'i': case 'O':
                        if (Array.isArray(rangeLeft))
                            return this.owner.writeLine(ERROR_NORANGE);
                        else if (rangeRight)
                            return this.owner.writeLine(ERROR_SYNTAX);
                        this.mode = MODE_INPUT;
                        return;


                    case 'n':
                        if (rangeRight)
                            return this.owner.writeLine(ERROR_SYNTAX);
                        this.showLineNumbers = !this.showLineNumbers;
                        return this.owner.writeLine(`Line numbers are ${(this.showLineNumbers ? 'on' : 'off')}`);

                    case 'p':
                        if (rangeRight)
                            return this.owner.writeLine(ERROR_SYNTAX);
                        if (Array.isArray(rangeLeft))
                            return this.printLines(rangeLeft[0], rangeLeft[1]);
                        else
                            return this.printLines(rangeLeft, 1);

                    case 'q':
                        if (this.dirty) {
                            return this.owner.writeLine(`Type 'Q' to exit editor without saving.`);
                        }
                        return this.onComplete();

                    case 'Q':
                        return this.onComplete();

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
            return this.owner.writeLine('Unrecognized command.');
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
     * Loads a file into the editor.
     * @param {string} filename The file to read
     */
    loadFile(filename) {
        try {
            if (this.efuns.isFile(filename)) {
                this.appendBuffer(this.efuns.readFile(filename).split('\n'));
            }
        }
        catch (err) {
            this.owner.writeLine(`Unable to read file '${filename}'`);
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
        return parts.length === 2 ? parts : parts[0];
    }

    /**
     * Print a line range
     * @param {number} start The line to start printing from
     * @param {number} lineCount The number of lines to try and print.
     */
    printLines(start, lineCount) {
        let page = this.content.slice(start, start + lineCount);
        if (page.length === 0) {
            this.owner.writeLine('At end of file.');
        }
        else if (this.showLineNumbers) {

            this.owner.writeLine(page.map((line, n) => `${this.formatLineNumber(n + start + 1)}  ${line}`).join('\n'));
        }
        else {
            this.owner.writeLine(page.join('\n'));
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
            result = this.currentLine;
        if (typeof state === 'object') {
            state.line = this.currentLine;
            state.lineTotal = this.content.length;
            state.dirty = this.dirty;
            state.filename = this.filename;
        }
        return result;
    }

    showHelp() {
        
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
