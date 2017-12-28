const
    MudExitsImplementation = require('../MudExitsImplementation');

class ZmudExitSupport extends MudExitsImplementation {
    /**
     * Render a list of exits to the client.
     * @param {string[]} list A list of exits.
     */
    renderExits(list) {
        let markup = '<RExits>Obvious exits: ' +
            list.map(exit => `<Ex>${exit}</Ex>`).join(' ') +
            '</RExits>';
        this.client.writeLine(markup);
    }

    updateSupportFlags(flags) {
        flags.exitsEnabled = true;
        return this;
    }
}

module.exports = ZmudExitSupport;
