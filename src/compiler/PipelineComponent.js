const
    PipelineContext = require('./PipelineContext').PipelineContext

class PipelineComponent {
    constructor(config) {
        this.enabled = typeof config.enabled === 'boolean' ? config.enabled : true;
        this.reusable = config.reusable;
        this.name = config.name;
    }

    /**
     * 
     * @param {PipelineContext} context
     */
    run(context) {
        throw new Error('Not implemented');
    }
}

module.exports = PipelineComponent;
