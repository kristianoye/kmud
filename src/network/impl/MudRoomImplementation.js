
const
    ClientImplementation = require('./ClientImplementation');

class MudRoomImplementation extends ClientImplementation {
    constructor(caps) {
        super(caps);
        this.caps.mxp = this;
    }

    renderRoomDescription() {
        return false;
    }

    renderRoomExits() {
        return false;
    }

    renderRoomName() {
        return false;
    }

    updateFlags(flags) {
        flags.roomDesc = false;
        flags.roomExits = false;
        flags.roomName = false;
        return this;
    }
}

module.exports = MudRoomImplementation;