
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
     * @param {any} input Passes the original value through.
     */
    expandColors(input) {
        let colorStart = input.indexOf('%^'),
            d = 0;

        while (colorStart > -1 && colorStart < input.length) {
            // Does it have an end
            let l = input.indexOf('%^', colorStart + 2); 
            if (l > -1) {
                let org = input.substr(colorStart + 2, l - colorStart - 2), m = org.toUpperCase(),
                    r = ColorLookups[m];

                // Increment or decrement RESET stack to determine 
                // how many resets to add to end
                d++;
                let replacement = `<span style="${r}">`;
                input = input.substr(0, colorStart) + replacement + input.substr(l + 2);
                colorStart = input.indexOf('%^', colorStart + r.length);
            }
            else {
                colorStart = input.indexOf('%^', colorStart + 2);
            }
        }
        while (d--) {
            input += '</span>';
        }
        return input.split(/\n/g).join('<br/>');
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
