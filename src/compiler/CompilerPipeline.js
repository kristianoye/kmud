const
    PipeContext = require('./PipelineContext'),
    PipelineComponent = require('./PipelineComponent'),
    MUDCompilerOptions = require('./MUDCompilerOptions');

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
     * @param {MUDCompilerOptions} options Options from the compiler
     * @returns {PipeLineContext|false} The compiler context or false if the pipe was disabled.
     */
    async executeAsync(context, options) {
        if (!this.enabled) {
            options.onDebugOutput(`Pipeline ${this.name} is disabled`, 2);
            return false;
        }

        if (!context.exists && !context.isEval)
            return false;

        options.onDebugOutput(`\tPipeline ${this.name} [${this.pipeline.length} stage(s)] is starting`, 2);
        context.update(PipeContext.CTX_RUNNING);

        for (let i = 0, max = this.pipeline.length; i < max; i++) {
            /** @type {PipelineComponent} */
            let component = this.pipeline[i];

            if (Array.isArray(component)) {
                let componentType = component[0],
                    componentArgs = component[1] || {};

                component = new componentType(componentArgs);
            }

            try
            {
                options.onPipelineStage(component.name, i, max);

                if (component.enabled) {
                    //  Listen for important events
                    //component.eventNames().forEach(eventName => {
                    //    switch (eventName) {
                    //        case 'compiler':
                    //            component.once(eventName, /** @param {MUDError[]} errors */ async errors => {
                    //                if (Array.isArray(errors) && errors.length > 0) {
                    //                    for (const err of errors) {
                    //                        await driver.callApplyAsync(driver.applyLogError.name, options.file, err);
                    //                    }
                    //                }
                    //            });
                    //            break;
                    //    }
                    //});
                    await component.runAsync(context, options, i, max);
                }
                else {
                    options.onDebugOutput(`\tPipeline ${this.name} is skipping disabled pipeline step #${(i + 1)}`, 3);
                }
            }
            catch (err) {
                context.addError(err);
                options.onDebugOutput(`\tPipeline ${this.name} [${this.pipeline.length} stage(s)] finished with error: ${err}`, 2);
                return context.update(PipeContext.CTX_ERRORED);
            }
        }
        context.update(PipeContext.CTX_FINISHED);
        options.onDebugOutput(`\tPipeline ${this.name} [${this.pipeline.length} stage(s)] is complete`, 2);
    }
}

module.exports = CompilerPipeline;
