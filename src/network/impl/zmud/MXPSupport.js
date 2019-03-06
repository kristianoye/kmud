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
        return Buffer.concat([Buffer.from([10, 13, 27]), Buffer.from(`[${tagId}z`, 'ascii')]);
    }

    /**
     * Send a block of MXP to the client over an OPEN line.
     * @param {string} text The text to send
     * @returns {Buffer} The prepared buffer.
     */
    openLine(text) {
        return Buffer.concat([this.mxpLineTag(MXP_OPEN), Buffer.from(text.replace(/\n/g, ''), 'utf8'), Buffer.from([10, 13])]);
    }

    /**
     * Send a block of MXP to the client over an SECURE line.
     * @param {string} text The text to send
     * @returns {Buffer} The prepared buffer.
     */
    secureLine(text) {
        return Buffer.concat([this.mxpLineTag(MXP_SECURE), Buffer.from(text.replace(/\n/g, ''), 'utf8'), Buffer.from([10, 13])]);
    }
}

module.exports = MXPSupport;