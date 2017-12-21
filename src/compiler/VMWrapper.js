
const
    PipelineContext = require('./PipelineContext').PipelineContext,
    VMAbstraction = require('./VMAbstraction'),
    MUDData = require('../MUDData'),
    MUDConfig = require('../MUDConfig').MUDConfig,
    MUDModule = require('../MUDModule'),
    CompilerTimeout = MUDConfig.driver.compiler.maxCompileTime || -1,
    fs = require('fs'),
    vm = require('vm');

var
    ExtensionText = MUDData.StripBOM(fs.readFileSync('src/Extensions.js', 'utf8'));

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

module.exports = new VMWrapper();
