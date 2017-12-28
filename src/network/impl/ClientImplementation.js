
class ClientImplementation {
    constructor(caps) {
        this.caps = caps;
        this.client = caps.client;
    }

    /**
     *
     * @param {Object.<string,boolean>} caps
     */
    updateSupportFlags(caps) {
        caps.colorEnabled = false;
        caps.htmlEnabled = false;
        caps.soundEnabled = false;
        caps.videoEnabled = false;
    }
}

ClientImplementation.create = function (type, terminalType) {
    let implBase = require(`./Mud${type}Implementation`);
    if (implBase) {
        return implBase.createImplementation(terminalType);
    }
    throw new Error(`Unknown client featuretype '${type}'`);
};

module.exports = ClientImplementation;
