
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
    TerminalColorsXterm = {
        'RESET': ANSI(0),
        'CLEARLINE': ESC('[L') + ESC('[G'),
        'B_BLACK': ANSI(40),
        'B_BLUE': ANSI(44),
        'B_CYAN': ANSI(46),
        'B_GREEN': ANSI(42),
        'B_MAGENTA': ANSI(45),
        'B_ORANGE': ANSI(43),
        'B_RED': ANSI(41),
        'B_WHITE': ANSI(47),
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
        'INITTERM': ESC("[H") + ESC("[2J"),
        'BLINK': ANSI(5),
        'UNDERLINE': ANSI(7),
        'PURPLE': ANSI(35),
        'LPURPLE': ANSI(95),
        'LBLUE': ANSI(94),
        'LRED': ANSI(91),
        'DARK': ANSI(90),
        'LGREEN': ANSI(92),
        'TORQUOISE': ANSI(96),
     };

class TerminalColorXterm extends MudColorImplementation {
    colorMap() {
        return TerminalColorsXterm;
    }

    init() {
        this.caps.color = this.client.color = this;
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

module.exports = TerminalColorXterm;
