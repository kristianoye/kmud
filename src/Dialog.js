/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: March 18, 2019
 *
 * Description: Provides some functionality for conversing with the console.
 */

const
    os = require('os'),
    eol = os.EOL,
    readline = require('readline'),
    stdout = process.stdout,
    rl = readline.createInterface({
        input: process.stdin,
        output: stdout
    });

const DlgResult = {
    /** Abort the process */
    Abort: 4,

    /** Exit the process normally */
    Exit: 1,
    OK: 2,
    Cancel: 3
};

/**
 * Write one ore more things to stdout (and append a newline)
 * @param {...any} args
 */
function writeLine(...args) {
    let line = args.join('') + eol;
    stdout.write(line);
}

/**
 * Prompt the user for a single value
 */
class SimplePrompt {
    /**
     * 
     * @param {{ error: string, pattern: RegExp|string, question: string|function():string, text: string, help: string, minLength: number, maxLength: number, min: number, max: number, type: 'string'|'number'|'character' }} prompt The prompt info
     */
    constructor(prompt) {
        this.prompt = prompt;
    }

    render(callback) {
        let p = this.prompt, q = p.question;

        if (typeof q === 'function') {
            q = q(this, this.prompt);
        }

        rl.question(q, resp => {
            resp = resp.trim();

            if (!resp) {
                if (typeof p.defaultValue === 'function')
                    resp = p.defaultValue();
                else if (typeof p.defaultValue !== 'undefined')
                    resp = p.defaultValue;
            }

            if (resp === "help") {
                writeLine(eol, p.help || 'No help available.', eol);
            }
            if (p.type === 'character') {
                if (resp.length > 1 || p.pattern && p.pattern.indexOf(resp) === -1)
                    writeLine(eol + (p.error || 'Invalid response') + eol);
                else
                    return callback(resp);
            }
            else if (p.type === 'string') {
                if (p.pattern && !p.pattern.test(resp))
                    writeLine(eol, eol, (p.error || 'Invalid format'));
                else if (p.minLength > 0 && resp.length < p.minLength)
                    writeLine(eol + eol + `Value must be at least ${p.minLength} character(s) long`);
                else if (p.maxLength > 0 && resp.length > p.maxLength)
                    writeLine(eol + eol + `Value may not exceed ${p.maxLength} character(s) in length`);
                else
                    return callback(resp);
            }
            else if (p.type === 'number') {
                let val = parseInt(resp);
                if (isNaN(val))
                    writeLine(eol, eol, p.error || 'Response must be numeric', eol);
                else if (typeof p.min === 'number' && val < p.min)
                    writeLine(eol, eol, p.error || `Value cannot be less than ${p.min}.`, eol);
                else if (typeof p.max === 'number' && val > p.max)
                    writeLine(eol, eol, p.error || `Value cannot be more than ${p.max}.`, eol);
                else
                    return callback(val);
            }
            else if (typeof p.type === 'function') {
                let result = p.type(resp);
                if (typeof result !== 'undefined')
                    return callback(result);
            }
            this.render();
        });
    }
}

/**
 * Presents a list of options to the user 
 */
class MainMenu {
    /**
     * Construct a new menu object.
     * @param {{ exit: function, text: string, help: string, prompt: string }} params The parameters used to construct the menu
     */
    constructor(params) {
        /** @type {Object.<string,{ text: string|function():string, callback: function(string|number):void, control: SimplePrompt|MainMenu|number }>} */
        this.options = {};
        this.onExit = function () { };
        this.help = params.help || (eol + 'Help not available.' + eol);
        this.helpTopics = {};
        this.prompt = params.prompt || 'Your choice:';
        this.text = params.text;
    }

    /**
     * Shorthand to add a prompt using the specified parameters.
     * @param {{ text: string|function():string, char: string, control: SimplePrompt|MainMenu|number, callback: function(string|number):void }} opt The options
     * @returns {MainMenu} Returns the menu itself
     */
    add(opt) {
        return this.addOption(opt.text || '', opt.char || 'x', opt.callback || function () { }, opt.control);
    }

    /**
     * Add some help text
     * @param {string|Object.<string,string>} subject The help subject.
     * @param {string} text The full help text.
     */
    addHelp(subject, text) {
        if (typeof subject === 'object') {
            this.helpTopics = Object.assign(this.helpTopics, subject)
        }
        else
            this.helpTopics[subject] = text;
        return this;
    }

    /**
     * 
     * @param {string|function():string} text The string to display in the menu.
     * @param {string} char The character that activates the option.
     * @param {function(string|number)} callback The code to execute when the option is selected.
     * @param {SimplePrompt|MainMenu|number} control The associated control (if any)
     * @returns {MainMenu} Returns the menu object
     */
    addOption(text, char, callback, control) {
        this.options[char] = { text, callback, control };
        return this;
    }

    /**
     * Clear the screen 
     * @param {number} x THe new X coordinate on the screen
     * @param {number} y The new Y coordinate on the screen.
     */
    clearScreen(x = 0, y = 0) {
        readline.cursorTo(process.stdout, x, y);
        readline.clearScreenDown(process.stdout);
    }

    exit(code = 0) {
        if (this.onExit()) {
            return this.render();
        }
        MenuStack.shift();
        return MenuStack[0];
    }

    render() {
        let text = this.text + eol + eol;

        this.optionKeys = [];

        if (typeof this.getOptions === 'function') {
            this.getOptions();
        }

        Object.keys(this.options).forEach((key, i) => {
            let line = this.options[key].text;

            if (typeof line === 'function')
                line = line(this, key, this.options[key]);

            if (typeof line === 'string') {
                let index = line.toLowerCase().indexOf(key.toLowerCase());

                if (index > -1) {
                    line = line.slice(0, index) + '[' + line.slice(index, index + key.length) + ']' + line.slice(index + 1);
                }
                line = (i < 10 ? ' ' : '') + i.toString() + ') ' + line;
                text += '\t' + line + eol;

                this.optionKeys.push(key);
            }
        });

        text += eol + `${this.prompt}: `;

        rl.question(text, resp => {
            let index = parseInt(resp = resp.trim()),
                help = /^help\s*(.+)?/.exec(resp);

            if (!isNaN(index) && !this.options.hasOwnProperty(index) && index < this.optionKeys.length)
                resp = this.optionKeys[index];

            if (Array.isArray(help)) {
                if (!help[1])
                    writeLine(eol + this.help + eol);
                else {
                    index = parseInt(help[1]);
                    if (!isNaN(index) && !this.options.hasOwnProperty(index) && index < this.optionKeys.length)
                        help[1] = this.optionKeys[index];
                    let helpText = this.helpTopics[help[1]] || `No help available for '${help[1]}'`;
                    writeLine(eol + helpText + eol);
                }
            }
            else if (this.options.hasOwnProperty(resp)) {
                let op = this.options[resp];

                if (op.control instanceof SimplePrompt) {
                    return op.control.render(resp => {
                        if (op.callback) op.callback(resp);
                        this.render();
                    });
                }
                else if (op.control instanceof MainMenu) {
                    MenuStack.unshift(op.control);
                    return op.control.render();
                }
                else {
                    let val = typeof op.control === 'number' ? op.control : 0;
                    if (typeof op.callback === 'function') val |= op.callback(resp) || 0;

                    switch (val) {
                        case DlgResult.Abort:
                        case DlgResult.Cancel:
                        case DlgResult.Exit:
                        case DlgResult.OK:
                            {
                                let parent = this.exit(val - 1);
                                if (parent)
                                    return parent.render();
                                else
                                    return process.exit(val - 1);
                            }
                            break;

                        default:
                            break;
                    }
                    this.render();
                }
            }
            else
                writeLine(eol, 'Invalid selection.', eol);

            this.render();
        });
    }
}

/**
 * Represents the root element of an application
 */
class ConsoleApp extends MainMenu {
    /**
     * Construct a new menu object.
     * @param {{ text: string, help: string, prompt: string }} params The parameters used to construct the menu
     * @param {function(MainMenu):void} init Initializer that is called when constructed
     */
    constructor(params, init) {
        super(params);

        MenuStack.push(this);
        if (init) init(this);
    }

    start() {
        this.clearScreen();
        this.render();
    }
}


/** @type {MainMenu[]} */
var MenuStack = [];


module.exports = {
    ConsoleApp,
    DlgResult,
    MainMenu,
    SimplePrompt,
    writeLine
};