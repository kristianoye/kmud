/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    { PipelineContext } = require('./PipelineContext'),
    VMAbstraction = require('./VMAbstraction'),
    MUDModule = require('../MUDModule'),
    fs = require('fs'),
    vm = require('vm');

var
    CompilerTimeout = 0,
    ExtensionText = '';

class VMWrapper extends VMAbstraction {
    constructor() {
        super();
    }

    /**
     * Load an object in its own virtual sandbox;
     * @param {PipelineContext} context The compiler context.
     * @param {MUDModule} module The module being loaded.
     * @returns {any} Returns a value from the virtual machine.
     */
    run(context, module) {
        module.context = vm.createContext(module.loader);
        module.loader.ctx = module.context;

        vm.runInContext(ExtensionText, module.context, {
            filename: './src/Extensions.js',
            displayErrors: true
        });

        let options = {
            filename: context.resolvedName,
            lineOffset: 0,
            produceCachedData: false,
            displayErrors: true
        };

        if (CompilerTimeout > 0) {
            options.timeout = CompilerTimeout;
        }

        let content = [`(() => { const [__DIR__, __FILE__] = ['${module.directory}', '${module.filename}'], `,
            '__filename = __FILE__, __dirname = __DIR__, efuns = createEfuns(), module = efuns, ',
            'require = function(str) { return efuns.require(str);  };',
            context.content,
            ' })()'].join('');
        let ctx = driver.getContext();

        ctx.directory = module.directory;
        ctx.filename = module.filename;

        let result = vm.runInContext(content, module.context, options);
        return result;
    }
}

VMWrapper.configureForRuntime = function (driver) {
    ExtensionText = driver.config.stripBOM(fs.readFileSync('src/Extensions.js', 'utf8'));
    CompilerTimeout = driver.config.driver.compiler.maxCompileTime;
};

module.exports = VMWrapper;
