/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    PipeContext = require('./PipelineContext'),
    PipelineComponent = require('./PipelineComponent'),
    MUDCompilerOptions = require('./MUDCompilerOptions'),
    PipelineContext = PipeContext.PipelineContext,
    { ExecutionContext } = require('../ExecutionContext');

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
     * @param {ExecutionContext} ecc Execution context.
     * @param {PipelineContext} context The context to execute.
     * @param {MUDCompilerOptions} options Options from the compiler
     * @returns {PipeLineContext|false} The compiler context or false if the pipe was disabled.
     */
    async executeAsync(ecc, context, options) {
        let frame = ecc.pushFrame(ecc.thisObject, 'executeAsync', options.file, true, 0);
        try {
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

                try {
                    options.onPipelineStage(component.name, i, max);

                    if (component.enabled) {
                        await component.runAsync(ecc.branch(), context, options, i, max);
                        if (typeof options.onCompilerStageExecuted === 'function') {
                            if (efuns.isAsync(options.onCompilerStageExecuted)) {
                                await options.onCompilerStageExecuted(context.fullPath, i, max, context.content, false);
                            }
                            else {
                                options.onCompilerStageExecuted(context.fullPath, i, max, context.content, false);
                            }
                        }
                    }
                    else {
                        options.onDebugOutput(`\tPipeline ${this.name} is skipping disabled pipeline step #${(i + 1)}`, 3);
                    }
                }
                catch (err) {
                    context.addError(err);
                    options.onDebugOutput(`\tPipeline ${this.name} [${this.pipeline.length} stage(s)] finished with error: ${err}`, 2);
                    if (typeof options.onCompilerStageExecuted === 'function') {
                        if (efuns.isAsync(options.onCompilerStageExecuted)) {
                            await options.onCompilerStageExecuted(context.fullPath, i, max, context.content, err);
                        }
                        else {
                            options.onCompilerStageExecuted(context.fullPath, i, max, context.content, err);
                        }
                    }
                    return context.update(PipeContext.CTX_ERRORED);
                }
            }
            context.update(PipeContext.CTX_FINISHED);
            options.onDebugOutput(`\tPipeline ${this.name} [${this.pipeline.length} stage(s)] is complete`, 2);
        }
        finally {
            frame.pop(true);
        }
    }
}

module.exports = CompilerPipeline;
