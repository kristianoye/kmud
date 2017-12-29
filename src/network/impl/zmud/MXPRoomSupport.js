const
    MudRoomImplementation = require('../MudRoomImplementation');

class MXPRoomSupport extends MudRoomImplementation {
    init() {
        this.client.transmit(this.client.mxp.openLine(`
        !-- Elements to support the Automapper -->
        <!ELEMENT RName '<FONT COLOR=Red><B>' FLAG="RoomName">
        <!ELEMENT RDesc FLAG='RoomDesc'>
        <!ELEMENT RExits '<FONT COLOR=Blue>' FLAG='RoomExit'>
        <!-- The next element is used to define a room exit link that sends
        the exit direction to the MUD if the user clicks on it -->
        <!ELEMENT Ex '<SEND>'>
        <!ELEMENT Chat '<FONT COLOR=Gray>' OPEN>
        <!ELEMENT Gossip '<FONT COLOR=Cyan>' OPEN>
        <!-- in addition to standard HTML Color specifications, you can use
        color attribute names such as blink -->
        <!ELEMENT ImmChan '<FONT COLOR=Red,Blink>'>
        <!ELEMENT Auction '<FONT COLOR=Purple>' OPEN>
        <!ELEMENT Group '<FONT COLOR=Blue>' OPEN>
        <!-- the next elements deal with the MUD prompt -->
        <!ELEMENT Prompt FLAG="Prompt">
        <!ELEMENT Hp FLAG="Set hp">
        <!ELEMENT MaxHp FLAG="Set maxhp">
        <!ELEMENT Mana FLAG="Set mana">
        <!ELEMENT MaxMana FLAG="Set maxmana">`));
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
