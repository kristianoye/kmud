const
    ClientImplementation = require('../ClientImplementation'),
    MXP_OPEN = 0,
    MXP_SECURE = 1,
    MXP_LOCKED = 2;

class MXPSupport extends ClientImplementation {
    init() {
        this.caps.mxp = this.client.mxp = this;
    }

    mxpLineTag(n) {
        return Buffer.concat([new Buffer([10, 13, 27]), new Buffer(`[${n}z`, 'ascii')]);
    }

    openLine(text) {
        return Buffer.concat([this.mxpLineTag(MXP_OPEN), new Buffer(text.replace(/\n/g, '').trim(), 'utf8'), new Buffer([10, 13])]);
    }

    secureLine(text) {
        return Buffer.concat([this.mxpLineTag(MXP_SECURE), new Buffer(text.replace(/\n/g, '').trim(), 'utf8'), new Buffer([10, 13])]);
    }
}

module.exports = MXPSupport;