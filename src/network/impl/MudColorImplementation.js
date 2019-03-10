﻿const
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
    constructor(caps) {
        super(caps);
        this.caps.color = this.client.color = this;
    }

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
        let chunks = s.split(/\%\^([a-zA-Z0-9]+)\%\^/);

        if (chunks.length > 1) {
            let lookup = this.colorMap(),
                multicolor = chunks.map(chunk => {
                    return lookup.hasOwnProperty(chunk) ? lookup[chunk] : chunk;
                }).join('');

            return multicolor;
        }
        return s;
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
