/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Provides text manipulation routines.
 */
const
    os = require('os');
const { ExecutionContext, CallOrigin, ExecutionFrame } = require('../ExecutionContext');

class TextHelper {
    /**
     * Display some text through a paging interface.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string|string[]} contentIn The content to display.
     * @param {{ onExit:function(), lines:number, maxLineLength:number, showLineNumbers:boolean, wrapText:boolean, exitAfterLast:boolean }} optionsIn Options controlling the pager behavior
     */
    static more(ecc, contentIn, optionsIn = {}) {
        /** @type {[ ExecutionFrame, string|string[], { onExit:function(), lines:number, maxLineLength:number, showLineNumbers:boolean, wrapText:boolean, exitAfterLast:boolean } ]} */
        let [frame, content, options] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'more', callType: CallOrigin.DriverEfun });
        try {
            let tp = efuns.thisPlayer(),
                prompt = false,
                reg = false,
                ptr = 0;

            let displayText = (pageOffset = 0, linesToShow = 0) => {
                let caps = efuns.clientCaps(tp),
                    width = caps.clientWidth,
                    linesToDisplay = linesToShow > 0 ? linesToShow : (options.lines || caps.clientHeight) - 2;

                if (pageOffset !== 0) {
                    if ((ptr += linesToDisplay * pageOffset) < 0) ptr = 0;
                }

                for (let i = 0, max = linesToDisplay; i < max; i++) {
                    if (ptr < content.length) {
                        let line = content[ptr++];

                        if (line.length > width) {
                            if (options.maxLineLength && line.length > options.maxLineLength)
                                line = line.slice(0, options.maxLineLength) + '...[TRUNCATED]...';
                            i += Math.floor(line.length / width);
                        }
                        tp.receiveMessage('more', line + efuns.eol);
                    }
                }
                return ptr < content.length;
            };

            if (typeof content === 'string') {
                content = content.split(/[\r][\n]/);
            }
            if (!Array.isArray(content))
                throw new Error(`Bad argument 1 to more(); Expects array of string or string (got ${typeof content})`);

            if (displayText()) {
                efuns.input.addPrompt('text',
                    {
                        default: false,
                        text: () => {
                            let pct = Math.floor((ptr * 1.0 / content.length * 1.0) * 100);
                            let result = prompt || `%^B_WHITE%^%^BLACK%^--More--(${pct}%)%^RESET%^ `;
                            prompt = false;
                            return result;
                        },
                        type: 'text'
                    },
                    (resp) => {
                        resp = resp.trim();
                        switch (resp.charAt(0)) {
                            case 'b':
                                displayText(-2);
                                return true;

                            case 'q':
                                return options.onExit ? options.onExit() : false; // done

                            case '=':
                                prompt = ptr.toString() + ' ';
                                return true;

                            case 'n':
                                {
                                    let found = false;

                                    if (reg === false) {
                                        prompt = '%^CLEARLINE%^%^B_WHITE%^%^BLACK%^No previous regular expression%^RESET%^ ';
                                        return true;
                                    }
                                    for (let i = ptr; i < content.length; i++) {
                                        if (reg.test(content[i])) {
                                            found = i;
                                            break;
                                        }
                                    }
                                    if (found === false) {
                                        prompt = '%^CLEARLINE%^%^B_WHITE%^%^BLACK%^Pattern not found%^RESET%^ ';
                                        return true;
                                    }
                                    else {
                                        ptr = Math.max(found - 2, 0);
                                        tp.receiveMessage('more', `...Skipping ${found - ptr} line(s)...`);
                                    }
                                }
                                break;

                            case '/':
                                {
                                    let found = false;

                                    reg = new RegExp(resp.slice(1));

                                    for (let i = ptr; i < content.length; i++) {
                                        if (reg.test(content[i])) {
                                            found = i;
                                            break;
                                        }
                                    }
                                    if (found === false) {
                                        prompt = '%^CLEARLINE%^%^B_WHITE%^%^BLACK%^Pattern not found%^RESET%^ ';
                                        return true;
                                    }
                                    else {
                                        ptr = Math.max(found - 2, 0);
                                        tp.receiveMessage('more', `...Skipping ${found - ptr} line(s)...`);
                                    }
                                }
                                break;

                            case '':
                                displayText();
                                return true;

                            case 's':
                                displayText(0, 1);
                                return true;

                            case '?':
                            case 'h':
                                tp.receiveMessage('more', `
-------------------------------------------------------------------------------
<space>                 Display next k lines of text [${options.lines || 'current screen size'}]
z                       Display next k lines of text [${options.lines || 'current screen size'}]
<return>                Display next line of text
d or ctrl-D             Scroll k lines [current scroll size, initially 11]*
q or Q or <interrupt>   Exit from more
s                       Skip forward k lines of text [1]
f                       Skip forward k screenfuls of text [1]
b or ctrl-B             Skip backwards k screenfuls of text [1]
'                       Go to place where previous search started
=                       Display current line number
/<regular expression>   Search for kth occurrence of regular expression [1]
n                       Search for kth occurrence of last r.e [1]
!<cmd> or :!<cmd>       Execute <cmd> in a subshell
v                       Start up /usr/bin/vi at current line
ctrl-L                  Redraw screen
:n                      Go to kth next file [1]
:p                      Go to kth previous file [1]
:f                      Display current file name and line number
.                       Repeat previous command
-------------------------------------------------------------------------------
`);
                                return true;

                        }
                        displayText();
                        return true;
                    });
            }
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Checks to see if the string ends with a newline.
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} s The string to check
     * @returns {boolean} True if the string has a newline
     */
    static trailingNewline(ecc, s) {
        let [frame, str] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'trailingNewline', callType: CallOrigin.DriverEfun });
        try {
            if (typeof str === 'string') {
                return str.endsWith(os.EOL) || str.endsWith('\n');
            }
            return false;
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Similar to String.endsWith() but checks to make sure
     * the text is not escaped.
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} text
     * @returns {boolean} Returns true if the string ends with text but is not escaped
     */
    static endsWithUnescaped(ecc, textIn, checkForIn) {
        let [frame, text, checkFor] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'endsWithUnescaped', callType: CallOrigin.DriverEfun });
        try {
            if (typeof text === 'string' && typeof checkFor === 'string' && text.trim().endsWith(checkFor)) {
                return text.trim().slice(-checkFor.length - 1).charAt(0) === '\\';
            }
            return false;
        }
        finally {
            frame?.pop();
        }
    }
}

module.exports = TextHelper;
