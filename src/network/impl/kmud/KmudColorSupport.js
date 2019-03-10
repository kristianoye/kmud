
const
    MudColorImplementation = require('../MudColorImplementation'),
    ColorLookups = {
        'RESET': 'color: initial;',
        'BOLD': 'font-weight: bold;',
        'BLACK': 'color: black;',
        'RED': 'color: red;',
        'BLUE': 'color: blue;',
        'CYAN': 'color: cyan;',
        'MAGENTA': 'color: magenta;',
        'ORANGE': 'color: orange;',
        'YELLOW': 'color: yellow;',
        'GREEN': 'color: green;',
        'WHITE': 'color: #efefef;'
    };


class KmudColorSupport extends MudColorImplementation {
    /**
     * Color expansion is currently performed on the client.
     * @param {string} input Passes the original value through.
     * @returns {string} The input with colors expanded.
     */
    expandColors(input) {
        let chunks = input.split(/\%\^([a-zA-Z0-9]+)\%\^/),
            result = input;

        if (chunks.length > 1) {
            let  depth = 0;

            result = chunks.map(chunk => {
                if (chunk === 'RESET') {
                    let result = '</span>'.repeat(depth);
                    depth = 0;
                    return result;
                }
                else if (chunk in ColorLookups) {
                    depth++;
                    return `<span style="${ColorLookups[chunk]}">`;
                }
                else
                    return chunk;
            }).join('');

            if (depth > 0)
                result += '</span>'.repeat(depth);
        }
        return result.split(/\n/g).join('<br/>');
    }

    /**
     * 
     * @param {Object.<string,boolean>} flags
     */
    updateSupportFlags(flags) {
        flags.colorEnabled = true;
    }
}

module.exports = KmudColorSupport;
