
/**
 * Describes what features the client is capable of supporting.
 *
 * See related specs for implementation details:
 *   - MXP/MSP: http://www.zuggsoft.com/zmud/mxp.htm
 */
class ClientCaps {
    constructor(clientInstance) {
        let
            colorEnabled = true,
            client = clientInstance,
            htmlEnabled = false,
            soundEnabled = false, // could be browser, could be MSP
            terminalType = false,
            terminalTypes = [],
            videoEnabled = false,
            height = 24,
            width = 80;

        if (client) {
            client.on('terminal type', (ttype) => {
                if (ttype.terminalType) {
                    let tty = ttype.terminalType.toLowerCase(),
                        n = terminalTypes.indexOf(tty);
                    if (n === -1) terminalTypes.push(tty);
                    if (!terminalType) terminalType = tty;
                }
            });
            client.on('window size', (term) => {
                height = term.height;
                width = term.width;
            });
        }

        Object.defineProperties(this, {
            clientHeight: {
                get: function () { return height; }
            },
            clientWidth: {
                get: function () { return width; }
            },
            colorEnabled: {
                get: function () { return colorEnabled; }
            },
            htmlEnabled: {
                get: function () { return htmlEnabled; }
            },
            soundEnabled: {
                get: function () { return soundEnabled; }
            },
            terminalType: {
                get: function () { return terminalType; }
            },
            videoEnabled: {
                get: function () { return videoEnabled; }
            }
        });
    }
}

module.exports = ClientCaps;
