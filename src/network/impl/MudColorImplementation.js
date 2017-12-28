const
    ClientImplementation = require('./ClientImplementation');

const TerminalColorsUnknown = {
    'RESET': '',
    'BOLD': '',
    'BLACK': '',
    'RED': '',
    'BLUE': '',
    'CYAN': '',
    'MAGENTA': '',
    'ORANGE': '',
    'YELLOW': '',
    'GREEN': '',
    'WHITE': ''
};

class MudColorImplementation extends ClientImplementation {
    /**
     * @returns {object} A mapping of color codes and client values.
     */
    colorMap() { return TerminalColorsUnknown; }

    /**
     * Expands color codes within a string to the corresponding values.
     * @param {string} s
     * @returns {string} The same string with the color codes expanded for the client.
     */
    expandColors(s) {
        let lookup = this.colorMap(),
            c = s.indexOf('%^'), d = 0;

        while (c > -1 && c < s.length) {
            var l = s.indexOf('%^', c + 2);
            if (l > -1) {
                var org = s.substr(c + 2, l - c - 2), m = org.toUpperCase(),
                    r = lookup[m];
                // Increment or decrement RESET stack to determine 
                // how many resets to add to end
                d += m === 'RESET' ? -1 : r ? 1 : 0;
                r = r || org;
                s = s.substr(0, c) + r + s.substr(l + 2);
                c = s.indexOf('%^', c + r.length);
            }
            else {
                c = s.indexOf('%^', c + 2);
            }
        }
        while (d-- > 0) {
            s += lookup['RESET'];
        }
        return s;
    }

    /**
     * 
     * @param {Object.<string,boolean>} flags
     */
    updateSupportFlags(flags) {
        flags.colorEnabled = false;
    }
}

/**
 * @returns {MudColorImplementation} A client-specific color translation implementation.
 */
MudColorImplementation.createImplementation = function (caps) {
    let implementationType = MudColorImplementation;

    switch (caps.terminalType) {
        case 'ansi':
        case 'vt100':
            implementationType = require('./ansi/TerminalColorAnsi');
            break;

        case 'kmud':
            implementationType = require('./kmud/KmudColorSupport');
            break;

        case 'xterm':
            implementationType = require('./xterm/TerminalColorXterm');
            break;

        case 'zmud':
        case 'cmud':
            implementationType = require('./zmud/TerminalColorZmud');
            break;
    }

    return new implementationType(caps);
};


module.exports = MudColorImplementation;
