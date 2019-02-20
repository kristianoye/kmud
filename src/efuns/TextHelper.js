
const
    os = require('os');

class TextHelper {
    /**
     * Checks to see if the string ends with a newline.
     * @param {string} s The string to check
     * @returns {boolean} True if the string has a newline
     */
    static trailingNewline(s) {
        if (typeof s === 'string') {
            return s.endsWith(os.EOL) || s.endsWith('\n');
        }
        return false;
    }
}

module.exports = TextHelper;
