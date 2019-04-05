
const
    os = require('os');

class TextHelper {
    /**
     * Display some text through a paging interface.
     * @param {string|string[]} content The content to display.
     * @param {{ onExit:function(), lines:number, maxLineLength:number, showLineNumbers:boolean, wrapText:boolean, exitAfterLast:boolean }} options Options controlling the pager behavior
     */
    static more(content, options = {}) {
        let tp = efuns.thisPlayer(),
            ptr = 0;

        let displayText = (pageOffset = 0) => {
            let caps = efuns.clientCaps(tp),
                width = caps.clientWidth,
                linesToDisplay = options.lines || caps.clientHeight;

            if (pageOffset !== 0) {
                ptr += (pageOffset * 2);
            }

            for (let i = 0, max = linesToDisplay - 2; i < max; i++) {
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
                    text: 'More: ',
                    type: 'text'
                },
                (resp) => {
                    switch (resp.trim().charAt(0)) {
                        case 'b':
                            ptr -= displayText(-1);
                            return true;

                        case 'q':
                            return options.onExit ? options.onExit() : false; // done

                        case '=':
                            tp.receiveMessage('more', ptr.toString() + efuns.eol);
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

    /**
     * Checks to see if the string ends with a newline.
     * 
     * @param {string} s The string to check
     * @returns {boolean} True if the string has a newline
     */
    static trailingNewline(s) {
        if (typeof s === 'string') {
            return s.endsWith(os.EOL) || s.endsWith('\n');
        }
        return false;
    }

    /**
     * Similar to String.endsWith() but checks to make sure
     * the text is not escaped.
     * 
     * @param {string} text
     * @returns {boolean} Returns true if the string ends with text but is not escaped
     */
    static endsWithUnescaped(text, checkFor) {
        if (typeof text === 'string' && typeof checkFor === 'string' && text.trim().endsWith(checkFor)) {
            return text.trim().slice(-checkFor.length - 1).charAt(0) === '\\';
        }
        return false;
    }
}

module.exports = TextHelper;
