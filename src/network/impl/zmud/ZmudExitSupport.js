const
    MudExitsImplementation = require('../MudExitsImplementation');

class ZmudExitSupport extends MudExitsImplementation {
    /**
     * Render a list of exits to the client.
     * @param {string[]} list A list of exits.
     */
    renderExits(list) { 
        let buffer = Buffer.concat([
            new Buffer([24]),
            new Buffer('[12z', 'ascii'),
            new Buffer([3]),
            new Buffer(list.join(', ') + '\n', 'ascii'),
            new Buffer([4])
        ]);
        this.client.writeLine(buffer.toString('utf8'));
    }

    updateSupportFlags(flags) {
        flags.exitsEnabled = true;
    }
}

module.exports = ZmudExitSupport;
