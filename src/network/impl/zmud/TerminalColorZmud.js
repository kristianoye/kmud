﻿
function ANSI(c) {
    var s = c.toString(), r = [27, 91];

    for (var i = 0; i < s.length; i++) {
        r.push(s.charCodeAt(i));
    }
    r.push(109);
    return Buffer.from(new Uint8Array(r)).toString('utf8');
}

function ESC(c) {
    var s = c.toString(), r = [27];

    for (var i = 0; i < s.length; i++) {
        r.push(s.charCodeAt(i));
    }
    return Buffer.from(new Uint8Array(r)).toString('utf8');
}

const MudColorImplementation = require('../MudColorImplementation'),
    TerminalColorsZmud = {
        'RESET': ANSI(0),
        'BOLD': ANSI(1),
        'BLACK': ANSI(30),
        'RED': ANSI(31),
        'BLUE': ANSI(34),
        'CYAN': ANSI(36),
        'MAGENTA': ANSI(35),
        'ORANGE': ANSI(33),
        'YELLOW': ANSI(1) + ANSI(33),
        'GREEN': ANSI(32),
        'WHITE': ANSI(37),
        'INITTERM': ESC("[H") + ESC("[2J")
    };

class TerminalColorZmud extends MudColorImplementation {
    colorMap() {
        return TerminalColorsZmud;
    }

    /**
     * 
     * @param {Object.<string,boolean>} flags
     */
    updateFlags(flags) {
        flags.color = true;
        return this;
    }
}

module.exports = TerminalColorZmud;
