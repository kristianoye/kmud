const
    MUDConfig = require('../MUDConfig'),
    MUDData = require('../MUDData');

class VMAbstraction {
    constructor() {
    }

    run() {
        throw new Error('Not implemented');
    }
}
var
    /** @type {VMAbstraction} */
    implementation;

module.exports = VMAbstraction;