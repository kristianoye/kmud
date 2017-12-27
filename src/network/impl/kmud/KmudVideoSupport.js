
const
    MudVideoImplementation = require('../MudVideoImplementation');

class KmudVideoSupport extends MudVideoImplementation {

    /**
     * 
     * @param {Object.<string,boolean>} flags
     */
    updateSupportFlags(flags) {
        flags.videoEnabled = true;
    }

}

module.exports = KmudVideoSupport;