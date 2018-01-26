const
    PipelineComponent = require('./PipelineComponent'),
    PipeContext = require('./PipelineContext');

    fs = require('fs');

class CompilerPipeline
{
    constructor(ext, config, resolver) {
        this.enabled = typeof config.enabled === 'boolean' ? config.enabled : true;
        this.extension = ext;
        this.loaderName = config.loader || 'MUDLoader';
        this.loaderOptions = config.loaderOptions || {};
        this.name = config.name || ext + ' Pipeline';
        this.pipeline = config.pipeline.map(p => resolver(p));
        this.type = config.type || 'unspecified';
    }

    /**
     * Returns a new compiler pipeline context.
     * @param {PipelineContext} filename
     */
    createContext(filename) {
        return new PipeContext.PipelineContext(filename, this);
    }

    /**
     * 
     * @param {PipelineContext} context The context to execute.
     * @returns {PipeLineContext|false} The compiler context or false if the pipe was disabled.
     */
    execute(context) {
        if (!this.enabled)
            return false;

        if (!context.exists && !context.isEval)
            return false;

        context.update(PipeContext.CTX_RUNNING);

        for (var i = 0, max = this.pipeline.length; i < max; i++) {
            var component = this.pipeline[i];

            if (Array.isArray(component)) {
                var componentType = component[0],
                    componentArgs = component[1] || {};

                component = new componentType(componentArgs);
            }

            try {
                component.run(context);
            }
            catch (err) {
                context.addError(err);
                return context.update(PipeContext.CTX_ERRORED);
            }
        }
        context.update(PipeContext.CTX_FINISHED);
    }


}

module.exports = CompilerPipeline;
