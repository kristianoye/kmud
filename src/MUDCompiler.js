/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

const
    MUDData = require('./MUDData'),
    MUDLoader = require('./MUDLoader'),
    MUDOSLoader = require('./MUDOSLoader'),
    acorn = require('acorn-jsx'),
    fs = require('fs'),
    ExtensionText = fs.readFileSync('src/Extensions.js', 'utf8'),
    PipeContext = require('./compiler/PipelineContext'),
    PipelineContext = PipeContext.PipelineContext,
    CompilerPipeline = require('./compiler/CompilerPipeline'),
    VMAbstraction = require('./compiler/VMAbstraction'),
    MUDModule = require('./MUDModule'),
    VM = VMAbstraction.getImplementation();

class MUDCompiler {
    constructor(config) {
        var comps = 0,
            self = this,
            vm = false;

        this.components = {};
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
                    parameters: Object.extend({ reusable: reuse, name: comp.name, enabled: enabled }, comp.parameters),
                    refCount: 0
                };
                comps++;
            });
        }
        if (comps === 0) {
            console.log('INFORMATION: No compiler components defined in config.');
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
                    xtra = spec.parameters || spec.args || {};
                    name = spec.id || 'unspecified';
                }
                if (!initData) {
                    throw new Error(`Configured language ${language.name} references undefined pipeline component: ${name}`);
                }
                var module = initData.module,
                    args = Object.extend(initData.parameters, xtra);

                initData.refCount++;

                return args.reusable === false ? [module, args] : new module(args);

            });
        });
    }

    dirname(path) {
        return path.slice(0, path.lastIndexOf('/') + 1);
    }

    /**
     * Create a loader for the specified pipeline and module.
     * @param {CompilerPipeline} pipeline The pipeline to execute.
     * @param {MUDModule} module The module to load.
     * @returns {MUDLoader} A mud loader instance.
     */
    getLoader(pipeline, module) {
        var loader = this.loaders[pipeline.loaderName];
        if (!loader) {
            throw new Error('Invalid loader requested');
        }
        return new loader(module.efunProxy, this.compileObject, module.directory);
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
     * @param {string} filename The name of the file
     * @param {boolean} reload Indicates the object is reloading.
     * @param {string} relativePath Look for the file relative to this directory.
     * @param {object} constructorArgs Objects to pass to the constructor.
     */
    compileObject(filename, reload, relativePath, constructorArgs) {

        if (!filename)
            return false;

        var context = new PipeContext.PipelineContext(filename),
            /** @type {MUDModule} */ module = MUDData.ModuleCache.get(context.basename),
            t0 = new Date().getTime(), virtualData = false;

        if (module && !reload && module.loaded === true)
            return module;

        if (MUDData.InGameMaster)
        {
            virtualData = MUDData.InGameMaster().compileVirtualObject(filename);
            context.virtualContext(virtualData);
        }
        if (!context.validExtension()) {
            for (var i = 0; i < this.validExtensions.length; i++) {
                if (context.validExtension(this.validExtensions[i])) break;
            }
            if (!context.exists) {
                if (MUDData.InGameMaster === false)
                    throw new Error('Could not load in-game master object!');
                throw new Error(`Could not load ${context.filename} [File not found]`);
            }
        }
        try {
            var isVirtual = virtualData !== false,
                pipeline =this.getPipeline(context);

            if (pipeline === false)
                throw new Error(`Could not load ${context.filename} [unknown extension]`);
            else if (!pipeline.enabled)
                throw new Error(`Could not load ${context.filename} [${pipeline.name} - not enabled]`);

            pipeline.execute(context);

            if (context.state === PipeContext.CTX_FINISHED) {
                if (!context.content)
                    throw new Error(`Could not load ${context.filename} [empty file?]`);

                module = MUDData.ModuleCache.getOrCreate(
                    context.filename,
                    context.resolvedName,
                    context.directory,
                    virtualData !== false);

                if (MUDData.Config.driver.useObjectProxies) {
                    module.allowProxy = true;
                }

                module.loader = this.getLoader(pipeline, module);
                VM.run(context, module);

                let result = module.context.primaryExport;

                if (!module.efunProxy.isClass(result)) {
                    throw new Error(`Error: Module ${context.filename} did not return a class; Did you forget to export?`);
                }

                module.allowProxy = module.loader.allowProxy;

                if (result) {
                    var isReload = module.loaded;

                    module.setClassRef(module.context.primaryExport);
                    module.singleton = isVirtual ? module.singleton || virtualData.singleton : module.context.isSingleton();

                    if (this.sealTypesAfterCompile) {
                        Object.seal(module.classRef);
                        Object.seal(module.classRef.prototype);
                    }

                    if (typeof module.classRef === 'function') {
                        try {
                            var instance = module.createInstance(0, isReload, constructorArgs);

                            if (!MUDData.DriverObject.validObject(instance())) {
                                throw new Error(`Could not load ${context.filename} [Illegal Object]`);
                            }

                            module.loaded = true;
                            MUDData.ModuleCache.store(module);

                            if (isReload) {
                                module.recompiled();
                            }
                            return module;
                        }
                        catch (e) {
                            throw MUDData.CleanError(e);
                        }
                    }
                    else {
                        throw new Error(`Could not load ${context.filename} [File did not return class definition]`);
                    }
                }
            }
            else {
                switch (context.state) {
                    case PipeContext.CTX_ERRORED:
                        throw new Error(`Could not load ${context.filename} [${context.errors[0]}]`);

                    case PipeContext.CTX_RUNNING:
                    case PipeContext.CTX_STOPPED:
                        throw new Error(`Could not load ${context.filename} [Incomplete Pipeline]`);

                    case PipeContext.CTX_INIT:
                        throw new Error(`Could not load ${context.filename} [Pipeline Failure]`);
                }
            }
        }
        catch (err) {
            if (module && module.stats) {
                module.stats.errors++;
            }
            if (module && !module.loaded) {
                MUDData.ModuleCache.delete(context.filename);
            }
            MUDData.CleanError(err);
            MUDData.DriverObject.logError(context.filename, err);
            throw err;
        }
        finally {
            var t1 = new Date().getTime();
            console.log('\t\tLoad timer: {0} [{1} ms]'.fs(filename, t1 - t0));
        }
        return false;
    }
}

module.exports = MUDCompiler;

