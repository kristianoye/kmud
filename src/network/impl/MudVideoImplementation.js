
class MudVideoImplementation {
    playVideo() {

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
