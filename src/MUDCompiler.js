/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    fs = require('fs');
const MUDCompilerOptions = require('./compiler/MUDCompilerOptions');
const DriverCompiler = require('./config/DriverCompiler');
const { ExecutionContext, CallOrigin } = require('./ExecutionContext');

const
    PipeContext = require('./compiler/PipelineContext'),
    PipelineContext = PipeContext.PipelineContext,
    CompilerPipeline = require('./compiler/CompilerPipeline'),
    MUDCache = require('./MUDCache');

var
    /** @type {import('./compiler/VMWrapper')} */
    VM,
    loaders = {};

class MUDCompiler {
    /**
     * Construct the in-game script compiler.
     * @param {GameServer} driverInstance A reference to the game driver/server
     * @param {DriverCompiler} config Optional settings from the config file.
     */
    constructor(driverInstance, config) {
        let comps = 0,
            self = this,
            vm = false;

        this.components = {};
        this.driver = driverInstance;
        this.allowEval = config.allowEval === true;
        /** @type {Object.<string,MUDLoader>} */
        this.loaders = {};
        this.pipelines = {};
        this.sealTypesAfterCompile = config.sealTypesAfterCompile;
        this.validExtensions = [];

        Object.keys(config.loaders).forEach(name => {
            this.loaders[name] = require(config.loaders[name]["file"]);
        });

        if (Array.isArray(config.components)) {
            config.components.forEach((comp, i) => {
                if (!comp.name) throw new Error(`Invalid pipeline component [${i}] - No Name Specified: ${JSON.stringify(comp)}`);
                if (!comp.file) throw new Error(`Invalid pipeline component [${i}] - No File Specified: ${JSON.stringify(comp)}`);

                var mod = require(comp.file),
                    reuse = typeof comp.reusable === 'boolean' ? comp.reusable : true,
                    enabled = typeof comp.enabled === 'boolean' ? comp.enabled : true;

                this.components[comp.id] = {
                    module: mod,
                    parameters: Object.assign({ reusable: reuse, name: comp.name, enabled: enabled }, comp.parameters),
                    refCount: 0
                };
                comps++;
            });
        }
        if (comps === 0) {
            logger.log('INFORMATION: No compiler components defined in config.');
        }
        Object.keys(config.languages).forEach(ext => {
            var language = config.languages[ext];
            this.validExtensions.push(ext);
            this.pipelines[ext] = new CompilerPipeline(ext, language, (spec) => {
                var initData = false, xtra = {}, name = 'unknown';

                if (typeof spec === 'string') {
                    name = spec;
                    initData = self.components[spec];
                }
                else if (Array.isArray(spec)) {
                    initData = self.components[spec[0]];
                    xtra = spec[1] || {};
                    name = spec[0] || 'unspecified';
                }
                else if (typeof spec === 'object') {
                    initData = self.components[spec.id];
                    xtra = spec.parameters || spec.args || spec;
                    name = spec.id || 'unspecified';
                }
                if (!initData) {
                    throw new Error(`Configured language ${language.name} references undefined pipeline component: ${name}`);
                }
                var module = initData.module,
                    args = Object.assign({}, initData.parameters, xtra);
                args.extension = ext;
                initData.refCount++;
                return args.reusable === false ? [module, args] : new module(args);

            });
        });
        this.extensionPattern = '(' + this.validExtensions.map(s => `\\${s}`).join('|') + ')$';
    }

    /**
     * Returns the directory portion of a virtual filename.
     * @param {string} path The full path to the file.
     * @returns {string} The directory portion of the path.
     */
    dirname(path) {
        return path.slice(0, path.lastIndexOf('/') + 1);
    }

    /**
     * Support for eval() type statements
     * @param {string} code The code to execute
     * @param {any} note
     * @param {any} callback
     */
    async evalAsync(code, note, callback) {
        if (!this.allowEval)
            throw new Error('Eval is disabled by the MUD configuration');

        let context = new PipeContext.PipelineContext('eval.jsx', true);
        let pipeline = this.getPipeline(context);

        context.content = code;
        await pipeline.executeAsync(context);

        if (context.state === PipeContext.CTX_FINISHED) {
            if (!context.content)
                throw new Error(`Could not load ${context.fullPath} [empty file?]`);
            return context.content;
        }
        else {
            switch (context.state) {
                case PipeContext.CTX_ERRORED:
                    throw new Error(`Could not load ${context.fullPath} [${context.errors[0].message}]`);

                case PipeContext.CTX_RUNNING:
                case PipeContext.CTX_STOPPED:
                    throw new Error(`Could not load ${context.fullPath} [Incomplete Pipeline]`);

                case PipeContext.CTX_INIT:
                    throw new Error(`Could not load ${context.fullPath} [Pipeline Failure]`);
            }
        }
    }

    /**
     * Create a loader for the specified pipeline and module.
     * @param {CompilerPipeline} pipeline The pipeline to execute.
     * @param {MUDCompilerOptions} compilerOptions Options to the compiler.
     * @returns {MUDLoader} A mud loader instance.
     */
    getLoader(pipeline) {
        let instance = loaders[pipeline.loaderName] || false;
        if (!instance) {
            let loaderType = this.loaders[pipeline.loaderName];
            if (!loaderType) {
                throw new Error(`Pipeline '${pipeline.name}' did not specify a loader type!`);
            }
            instance = loaders[pipeline.loaderName] = new loaderType(this);
        }
        return instance;
    }

    /**
     * Returns the pipeline required to load thecontext.
     * @param {PipelineContext} ctx The context to be compiled.
     * @returns {CompilerPipeline} The pipeline associated with the specified extension.
     */
    getPipeline(ctx) {
        return ctx.extension in this.pipelines ? this.pipelines[ctx.extension] : false;
    }

    /**
     * Attempts to compile the requested file into a usable MUD object.
     * @param {ExecutionContext} ecc
     * @param {Partial<MUDCompilerOptions>} options Hints for the compiler.
     * @returns {MUDModule} The compiled module
     */
    async compileObjectAsync(ecc, options) {
        let frame = ecc.push({ file: __filename, method: 'compileObjectAsync', lineNumber: 178, isAsync: true, callType: CallOrigin.Driver });
        try {
            if (!options)
                throw new Error('compileObject() called with invalid parameter(s)');
            else if (typeof options === 'string') {
                options = {
                    file: options,
                    reload: false
                };
            }
            else if (typeof options !== 'object') {
                throw new Error('compileObject() called with invalid parameter(s)');
            }
            if (false === options instanceof MUDCompilerOptions) {
                options = new MUDCompilerOptions(options);
            }
            let context = await PipeContext.PipelineContext.create(frame.branch(), options, this.extensionPattern),
                module = context.module,
                t0 = efuns.ticks,
                cleanError = false;

            if (options.source)
                context.setContent(options);

            if (module && !options.reload && module.loaded === true)
                return module;

            if (!context.exists || context.isVirtual) {
                return await this.compileVirtualAsync(frame.branch(), context, options);
            }
            try {
                let pipeline = this.getPipeline(context);

                if (pipeline === false)
                    throw new Error(`Could not load ${context.fullPath} [unknown extension]`);
                else if (!pipeline.enabled)
                    throw new Error(`Could not load ${context.fullPath} [${pipeline.name} - not enabled]`);

                module = this.driver.cache.getOrCreate(context, false, options);

                await pipeline.executeAsync(ecc.branch(), context, options);

                if (context.state === PipeContext.CTX_FINISHED) {
                    if (!context.content)
                        throw new Error(`Could not load ${context.fullPath} [empty file?]`);

                    //module = this.driver.cache.getOrCreate(
                    //    context.filename,
                    //    context.resolvedName,
                    //    context.directory,
                    //    false,
                    //    options);

                    if (!driver.preCompile(ecc.fork(), module))
                        throw new Error(`Module ${context.fullPath} was rejected by driver in pre-compiler stage`);

                    module.loader = this.getLoader(pipeline, options);
                    if (options.altParent) {
                        module.loader[options.altParent.name] = options.altParent;
                    }
                    module.isCompiling = true;
                    if (typeof options.onPipelineComplete === 'function') {
                        options.onPipelineComplete(context.content);
                    }
                    module.exports = false;
                    let result = await VM.runAsync(ecc.branch({ lineNumber: 245, hint: 'VM.runAsync' }), context, module);

                    delete module.isCompiling;
                    if (result instanceof Error)
                        throw result;

                    if (this.sealTypesAfterCompile && !options.noSeal) {
                        module.eventSealTypes();
                    }
                    let isReload = module.loaded === true;

                    if (isReload)
                        await module.eventRecompiled(options);
                    else {
                        module.loaded = true;
                        driver.cache.store(module);
                    }

                    return module;
                }
                else {
                    switch (context.state) {
                        case PipeContext.CTX_ERRORED:
                            throw new Error(`Could not load ${context.fullPath} [${context.errors[0].message}]`);

                        case PipeContext.CTX_RUNNING:
                        case PipeContext.CTX_STOPPED:
                            throw new Error(`Could not load ${context.fullPath} [Incomplete Pipeline]`);

                        case PipeContext.CTX_INIT:
                            throw new Error(`Could not load ${context.fullPath} [Pipeline Failure]`);
                    }
                }
            }
            catch (err) {
                let t1 = efuns.ticks;
                if (module && module.stats) {
                    module.stats.errors++;
                }
                if (module && !module.loaded) {
                    driver.cache.delete(context.fullPath);
                }
                this.driver.cleanError(cleanError = err);
                await this.driver.logError(frame.branch(), context.fullPath, err);
                logger.log(`\tLoad timer: ${options.file} [${(t1 - t0)} ms; ERROR: ${cleanError.message}]}`);
                logger.log(cleanError.stack || cleanError.trace);
                throw err;
            }
            finally {
                if (options.altParent && module) {
                    delete module.loader[options.altParent.name];
                }
                let t1 = efuns.ticks;
                if (!cleanError) {
                    logger.log(`\tLoad timer: ${options.file} [${(t1 - t0)} ms]`);
                }
            }
            return false;
        }
        catch (err) {
            frame.error = err;
            throw err;
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Try and compile a virtual object
     * @param {ExecutionContext} ecc The current callstack
     * @param {PipelineContext} context
     * @param {MUDCompilerOptions} options Compiler options
     */
    async compileVirtualAsync(ecc, context, options = {}) {
        let frame = ecc.push({ file: __filename, method: 'compileVirtualAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            //  Try virtual compilation
            let virtualContext, virtualResult, module;

            if (!this.driver.masterObject)
                throw new Error('Could not load in-game master object!');

            //  Attempt to compile a virtual object.
            try {
                //module = this.driver.cache.getOrCreate(context, true, options);

                let args = options.args || [], objectId = driver.efuns.getNewId(frame.context);

                virtualContext = frame.context.addVirtualCreationContext({
                    objectId,
                    isVirtual: true,
                    filename: context.fullPath
                });

                virtualResult = await driver.compileVirtualObject(frame.branch(), virtualContext.filename, args);

                module = virtualContext.module;
            }
            catch (err) {
                console.log(`compileVirtual() error: ${err.message}\n${err.stack}`);
                driver.cache.delete(context.fullPath);
            }
            finally {
                frame.context.popCreationContext();
            }

            if (!virtualResult)
                throw new Error(`Could not load ${context.fullPath} [File not found]`);

            return module;
        }
        finally {
            frame.pop();
        }
    }

    get supportedExtensions() {
        return Object.keys(this.pipelines || { '.js': undefined });
    }
}

MUDCompiler.configureForRuntime = function (driver) {
    let implementation = false;

    switch (driver.config.driver.compiler.virtualMachine) {
        case 'vm':
            implementation = require('./compiler/VMWrapper');
            break;

        case 'vm2':
            implementation = require('./compiler/VM2Wrapper');
            break;

        default:
            implementation = require(driver.config.driver.compiler.virtualMachine);
            break;
    }
    VM = new implementation(driver.config.driver.compiler.virtualMachineOptions || {});
    implementation.configureForRuntime(driver);
    if (driver) driver.vm = VM;
    return MUDCompiler;
};

module.exports = MUDCompiler;
