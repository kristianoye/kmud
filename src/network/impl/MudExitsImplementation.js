
const
    ClientImplementation = require('./ClientImplementation');

class MudExitsImplementation extends ClientImplementation {
    renderExits() {

    }

    updateSupportFlags(flags) {
        flags.exitsEnabled = false;
    }
}

MudExitsImplementation.createImplementation = function (caps) {
    let implementationType = MudExitsImplementation;
    switch (caps.terminalType) {
        case 'cmud':
        case 'zmud':
            implementationType = require('./zmud/ZmudExitSupport');
            break;
    }
    return new implementationType(caps);
};

module.exports = MudExitsImplementation;