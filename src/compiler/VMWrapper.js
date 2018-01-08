
const
    PipelineContext = require('./PipelineContext').PipelineContext,
    VMAbstraction = require('./VMAbstraction'),
    MUDConfig = require('../MUDConfig'),
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

        let result = vm.runInContext(context.content, module.context, options);

        return result;
    }
}

VMWrapper.configureForRuntime = function (driver) {
    ExtensionText = MUDConfig.stripBOM(fs.readFileSync('src/Extensions.js', 'utf8'));
    CompilerTimeout = MUDConfig.get().driver.compiler.maxCompileTime;
};

module.exports = VMWrapper;
