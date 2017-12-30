const
    DriverFeature = require('../config/DriverFeature'),
    EFUNProxy = require('../EFUNProxy'),
    FeatureBase = require('./FeatureBase'),
    MUDData = require('../MUDData'),
    MUDObject = require('../MUDObject'),
    MUDStorage = require('../MUDStorage'),
    MODE_INPUT = 0,
    MODE_COMMAND = 1;

class EditorInstance {
    /**
     * Create an editor instance
     * @param {Object.<string,any>} options
     */
    constructor(options) {
        /** @type {string[]} */
        this.buffer = [];

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
        this.mode = MODE_INPUT;

        /** @type {function} */
        this.onComplete = function () { };

        /** @type {MUDObject} */
        this.owner = options.owner;

        /** @type {boolean} */
        this.restricted = options.resticted;

        /** @type {boolean} */
        this.showLineNumbers = options.showLineNumbers || false;
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

    /**
     *  
     * @param {string} cmd
     * @returns {string}
     */
    executeCommand(cmd) {
        if (this.mode === MODE_INPUT) {
            if (cmd === '.') {
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
            let c = cmd.charAt(0) || '';
            switch (c) {
                case 'a':
                    break;

                case 'n':
                    this.showLineNumbers = !this.showLineNumbers;
                    this.owner.writeLine(`Line numbers ${(this.showLineNumbers ? 'on' : 'off')}`);
                    break;

                case 'q': case 'quit':
                    if (this.dirty) {
                        this.owner.writeLine(`Type 'Q' to exit editor without saving.`);
                    }
                    return this.onComplete();

                case 'Q':
                    return this.onComplete();

                case 'z':
                    let page = this.content.slice(this.currentLine, this.height);
                    if (this.showLineNumbers) {
                        this.owner.writeLine(page.map((line, n) => `${(this.currentLine + n)}  ${line}`).join('\n'));
                    }
                    else {
                        this.owner.writeLine(page.join('\n'));
                    }
                    this.currentLine += page.length;
                    break;

                default:
                    let line = parseInt(cmd) - 1;
                    if (line > -1) {
                        this.currentLine = line;
                        this.owner.writeLine(this.content[this.currentLine]);
                    }
            }
        }
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
        }
        flags.editor = true;
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
                        options = optionsIn || {};

                    options.efuns = this;
                    options.filename = file && file.length > 0 ? file : false;
                    options.owner = thisEditor;
                    options.height = $storage.getClientCaps().clientHeight || 24;
                    options.width = $storage.getClientCaps().clientWidth || 80;
                    options.restricted = restricted || options.restricted || false;

                    let $editor = new EditorInstance(options);

                    if (options.filename) $editor.loadFile(options.filename);
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
