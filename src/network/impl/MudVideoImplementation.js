const
    ClientImplementation = require('./ClientImplementation');

class MudVideoImplementation extends ClientImplementation {
    playVideo() {

    }

    /**
     * 
     * @param {Object.<string,boolean>} flags
     */
    updateSupportFlags(flags) {
        flags.videoEnabled = false;
    }
}

MudVideoImplementation.createImplementation = function (terminalType, version) {
    let implementationType = MudVideoImplementation;

    switch (terminalType) {
        case 'kmud':
            implementationType = require('./kmud/KmudVideoSupport');
            break;
    }

    return new implementationType();
};

module.exports = MudVideoImplementation;
