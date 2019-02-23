
const
    os = require('os');

class TextHelper {
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
