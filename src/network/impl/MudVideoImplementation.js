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

MudVideoImplementation.createImplementation = function (caps) {
    let implementationType = MudVideoImplementation;

    switch (caps.client.terminalType) {
        case 'kmud':
            implementationType = require('./kmud/KmudVideoSupport');
            break;
    }

    return new implementationType(caps);
};

module.exports = MudVideoImplementation;
