const
    ClientImplementation = require('./ClientImplementation');

class MudVideoImplementation extends ClientImplementation {
    constructor(caps) {
        super(caps);
        this.caps.video = this;
    }

    playVideo() {

    }

    /**
     * 
     * @param {Object.<string,boolean>} flags
     */
    updateFlags(flags) {
        flags.video = false;
        return this;
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
