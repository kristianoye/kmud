
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
            caps = efuns.clientCaps(tp);

        if (typeof content === 'string') {
            content = content.split(/[\r][\n]/);
        }
        if (!Array.isArray(content))
            throw new Error(`Bad argument 1 to more(); Expects array of string or string (got ${typeof content})`);

        let linesToDisplay = options.lines || caps.clientHeight;

        efuns.prompt()
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
