const
    MudRoomImplementation = require('../MudRoomImplementation');

class MXPRoomSupport extends MudRoomImplementation {
    init() {
        this.client.transmit(this.client.mxp.secureLine(`
            <!ELEMENT RName FLAG='RoomName'>
            <!ELEMENT RDesc FLAG='RoomDesc'>
            <!ELEMENT RExits FLAG='RoomExit'>
            <!ELEMENT Ex '<SEND>'>`));
    }

    renderRoomDescription(text) {
        this.client.transmit(this.client.mxp.secureLine(`<RDesc>${text}</RDesc>`));
        return true;
    }

    /**
     * Render a list of exits to the client.
     * @param {string} prefix
     * @param {string[]} list A list of exits.
     */
    renderRoomExits(prefix, list) {
        let markup = `<RExits>${(prefix || 'Obvious exits:')} ` +
            list.map(exit => `<Ex>${exit}</Ex>`).join(', ') + '</RExits>';
        this.client.transmit(this.client.mxp.openLine(markup));
        return true;
    }

    renderRoomName(name) {
        this.client.transmit(this.client.mxp.openLine(`<RName>${name}</RName>`));
        return true;
    }

    updateSupportFlags(flags) {
        flags.exitsEnabled = true;
        return this;
    }
}

module.exports = MXPRoomSupport;
