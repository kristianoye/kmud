
const
    ClientImplementation = require('./ClientImplementation');

class MudExitsImplementation extends ClientImplementation {
    constructor(caps) {
        super(caps);
        this.caps.exits = this;
    }

    renderExits() { }

    updateFlags(flags) {
        flags.exits = false;
        return this;
    }
}

module.exports = MudExitsImplementation;