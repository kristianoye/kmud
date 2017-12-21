const
    MUDConfig = require('../MUDConfig').MUDConfig,
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

/**
 * @returns {VMAbstraction}
 */
VMAbstraction.getImplementation = function () {
    if (implementation)
        return implementation;

    switch (MUDConfig.driver.compiler.virtualMachine) {
        case 'vm':
            implementation = require('./VMWrapper');
            break;

        case 'vm2':
            implementation = require('./VM2Wrapper');
            break;

        default:
            throw new Error(`Unrecognized virtual machine type: ${MUDConfig.driver.compiler.virtualMachine}`);
    }

    return (MUDData.VirtualMachine = implementation);
};

module.exports = VMAbstraction;