
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