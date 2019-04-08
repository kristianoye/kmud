
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
    TerminalColorsAnsi = {
        'B_BLACK': ANSI(40),
        'B_BLUE': ANSI(44),
        'B_CYAN': ANSI(46),
        'B_GREEN': ANSI(42),
        'B_MAGENTA': ANSI(45),
        'B_ORANGE': ANSI(43),
        'B_RED': ANSI(41),
        'B_WHITE': ANSI(47),
        'RESET': ANSI(0),
        'BOLD': ANSI(1),
        'BLACK': ANSI(30),
        'RED': ANSI(31),
        'BLUE': ANSI(34),
        'CYAN': ANSI(36),
        'MAGENTA': ANSI(35),
        'ORANGE': ANSI(33),
        'RESET': ANSI("0"),
        'YELLOW': ANSI(1) + ANSI(33),
        'GREEN': ANSI(32),
        'WHITE': ANSI(37),
        'CLEARLINE': ESC('[L') + ESC('[G'),
        'INITTERM': ESC("[H") + ESC("[2J")
    };

class TerminalColorAnsi extends MudColorImplementation {
    colorMap() {
        return TerminalColorsAnsi;
    }

    get supportsColor() { return true; }

    /**
     * 
     * @param {Object.<string,boolean>} flags
     */
    updateSupportFlags(flags) {
        flags.colorEnabled = true;
    }
}

module.exports = TerminalColorAnsi;
