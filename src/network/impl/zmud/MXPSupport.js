const
    ClientImplementation = require('../ClientImplementation'),
    MXP_OPEN = 0,
    MXP_SECURE = 1,
    MXP_LOCKED = 2;

class MXPSupport extends ClientImplementation {
    init() {
        this.caps.mxp = this.client.mxp = this;
    }

    /**
     * Creates a new MXP tag line prepended with a CR + LF to ensure it appears on its own line.
     * @param {number} tagId The MXP tag number to send.
     */
    mxpLineTag(n) {
        return Buffer.concat([new Buffer([10, 13, 27]), new Buffer(`[${tagId}z`, 'ascii')]);
    }

    openLine(text) {
        return Buffer.concat([this.mxpLineTag(MXP_OPEN), new Buffer(text.replace(/\n/g, ''), 'utf8'), new Buffer([10, 13])]);
    }

    secureLine(text) {
        return Buffer.concat([this.mxpLineTag(MXP_SECURE), new Buffer(text.replace(/\n/g, ''), 'utf8'), new Buffer([10, 13])]);
    }
}

module.exports = MXPSupport;