
const
    MudColorImplementation = require('../MudColorImplementation');

class KmudColorSupport extends MudColorImplementation {
    /**
     * Color expansion is currently performed on the client.
     * @param {any} s Passes the original value through.
     */
    expandColors(s) {
        return s;
    }
}

module.exports = KmudColorSupport;
