﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    fs = require('fs');
const MUDCompilerOptions = require('./compiler/MUDCompilerOptions');
const DriverCompiler = require('./config/DriverCompiler');

const
    PipeContext = require('./compiler/PipelineContext'),
    PipelineContext = PipeContext.PipelineContext,
    CompilerPipeline = require('./compiler/CompilerPipeline'),
    MUDCache = require('./MUDCache');

var
    VM, loaders = {};

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
                throw new Error(`Could not load ${context.filename} [empty file?]`);
            return context.content;
        }
        else {
            switch (context.state) {
                case PipeContext.CTX_ERRORED:
                    throw new Error(`Could not load ${context.filename} [${context.errors[0].message}]`);

                case PipeContext.CTX_RUNNING:
                case PipeContext.CTX_STOPPED:
                    throw new Error(`Could not load ${context.filename} [Incomplete Pipeline]`);

                case PipeContext.CTX_INIT:
                    throw new Error(`Could not load ${context.filename} [Pipeline Failure]`);
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
     * @param {MUDCompilerOptions|string} options Hints for the compiler.
     * @param {MUDCompilerOptions} moreOptions Hints for the compiler.
     * @returns {MUDModule} The compiled module
     */
    compileObject(options, moreOptions) {
        throw new Error('compileObject(): Syncronous compiling is no longer supported.');
    }

    /**
     * Attempts to compile the requested file into a usable MUD object.
     * @param {Partial<MUDCompilerOptions>} options Hints for the compiler.
     * @returns {MUDModule} The compiled module
     */
    async compileObjectAsync(options) {
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
        let context = await PipeContext.PipelineContext.create(options, this.extensionPattern),
            module = context.module,
            t0 = efuns.ticks,
            cleanError = false;

        if (options.source)
            context.setContent(options);

        if (module && !options.reload && module.loaded === true)
            return module;

        if (!context.exists || context.isVirtual) {
            return await this.compileVirtualAsync(context, options).
                catch(err => { throw err; });
        }
        try {
            let pipeline = this.getPipeline(context);

            if (pipeline === false)
                throw new Error(`Could not load ${context.filename} [unknown extension]`);
            else if (!pipeline.enabled)
                throw new Error(`Could not load ${context.filename} [${pipeline.name} - not enabled]`);

            module = this.driver.cache.getOrCreate(context, false, options);

            await driver.driverCallAsync('compileObjectAsync', async () => {
                await pipeline.executeAsync(context, options);
            }, context.filename, true);

            if (context.state === PipeContext.CTX_FINISHED) {
                if (!context.content)
                    throw new Error(`Could not load ${context.filename} [empty file?]`);

                //module = this.driver.cache.getOrCreate(
                //    context.filename,
                //    context.resolvedName,
                //    context.directory,
                //    false,
                //    options);

                if (!driver.preCompile(module))
                    throw new Error(`Module ${context.filename} was rejected by driver in pre-compiler stage`);

                module.loader = this.getLoader(pipeline, options);
                if (options.altParent) {
                    module.loader[options.altParent.name] = options.altParent;
                }
                module.isCompiling = true;
                let result = await driver.driverCallAsync(
                    'runInContext',
                    async ecc => {
                        if (typeof options.onPipelineComplete === 'function') {
                            options.onPipelineComplete(context.content);
                        }
                        //  Clear previous exports in case they've changed
                        module.exports = false;
                        let inner = await VM.runAsync(context, module);
                        return inner;
                    },
                    context.filename,
                    true);

                delete module.isCompiling;
                if (result instanceof Error)
                    throw result;

                if (this.sealTypesAfterCompile && !options.noSeal) {
                    module.eventSealTypes();
                }
                let isReload = module.loaded === true;

                if (isReload)
                    await module.eventRecompiled(options);
                else
                {
                    module.loaded = true;
                    driver.cache.store(module);
                }

                return module;
            }
            else {
                switch (context.state) {
                    case PipeContext.CTX_ERRORED:
                        throw new Error(`Could not load ${context.filename} [${context.errors[0].message}]`);

                    case PipeContext.CTX_RUNNING:
                    case PipeContext.CTX_STOPPED:
                        throw new Error(`Could not load ${context.filename} [Incomplete Pipeline]`);

                    case PipeContext.CTX_INIT:
                        throw new Error(`Could not load ${context.filename} [Pipeline Failure]`);
                }
            }
        }
        catch (err) {
            let t1 = efuns.ticks;
            if (module && module.stats) {
                module.stats.errors++;
            }
            if (module && !module.loaded) {
                driver.cache.delete(context.filename);
            }
            this.driver.cleanError(cleanError = err);
            await this.driver.logError(context.filename, err);
            logger.log(`\tLoad timer: ${options.file} [${(t1 - t0)} ms; ERROR: ${cleanError.message}]}`);
            logger.log(cleanError.stack || cleanError.trace);
            throw err;
        }
        finally {
            let t1 = efuns.ticks, ecc = driver.getExecution();
            if (!cleanError) {
                if (ecc)
                    logger.log(`\tLoad timer: ${options.file} [${(t1 - t0)} ms; ${ecc.stack.length}]`);
                else
                    logger.log(`\tLoad timer: ${options.file} [${(t1 - t0)} ms]`);
            }
        }
        return false;
    }

    /**
     * Try and compile a virtual object
     * @param {PipelineContext} context
     * @param {MUDCompilerOptions} options Compiler options
     */
    async compileVirtualAsync(context, options = {}) {
        //  Try virtual compilation
        let virtualContext, module;

        if (!this.driver.masterObject)
            throw new Error('Could not load in-game master object!');

        //  Attempt to compile a virtual object.
        let virtualResult = await driver.driverCallAsync('compileVirtual', async ecc => {
            try {
                //module = this.driver.cache.getOrCreate(context, true, options);

                let args = options.args || [], objectId = driver.efuns.getNewId();

                virtualContext = ecc.addVirtualCreationContext({
                    objectId,
                    isVirtual: true,
                    filename: context.filename
                });

                let virtualResult = await driver.compileVirtualObject(virtualContext.filename, args);

                args.forEach(a => {
                    if (typeof a === 'object') {
                        driver.driverCall('setProperty', eccInner => {
                            Object.keys(a).forEach(k => {
                                if (k in virtualResult) virtualResult[k] = a[k];
                            });
                        });
                    }
                });

                module = virtualContext.module;
                return virtualResult;
            }
            catch (err) {
                console.log(`compileVirtual() error: ${err.message}`);
                driver.cache.delete(context.filename);
            }
            finally {
                ecc.popCreationContext();
            }
        }, context.filename)
            .catch(err => { throw err; })

        if (!virtualResult)
            throw new Error(`Could not load ${context.filename} [File not found]`);

        return module;
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
