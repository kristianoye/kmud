const
    { PipelineContext } = require('./PipelineContext'),
    MUDCompilerOptions = require('./MUDCompilerOptions');

class PipelineComponent {
    constructor(config) {
        this.enabled = typeof config.enabled === 'boolean' ? config.enabled : true;
        this.reusable = config.reusable;
        this.name = config.name;
    }

    /**
     * 
     * @param {PipelineContext} context
     * @param {MUDCompilerOptions} options
     * @param {number} step
     * @param {number} maxStep
     */
    async runAsync(context, options, step, maxStep) {
        throw new Error('Not implemented');
    }
}

module.exports = PipelineComponent;
