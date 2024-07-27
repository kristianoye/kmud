const
    { PipelineContext } = require('./PipelineContext'),
    MUDCompilerOptions = require('./MUDCompilerOptions'),
    { ExecutionContext } = require('../ExecutionContext'),
    events = require('events');

class PipelineComponent extends events.EventEmitter {
    constructor(config) {
        super();

        this.enabled = typeof config.enabled === 'boolean' ? config.enabled : true;
        this.reusable = config.reusable;
        this.name = config.name;
    }

    /**
     * @param {ExecutionContext} ecc
     * @param {PipelineContext} context
     * @param {MUDCompilerOptions} options
     * @param {number} step
     * @param {number} maxStep
     */
    async runAsync(ecc, context, options, step, maxStep) {
        throw new Error('Not implemented');
    }
}

module.exports = PipelineComponent;
