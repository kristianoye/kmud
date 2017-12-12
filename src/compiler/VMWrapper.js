
const
    PipelineContext = require('./PipelineContext').PipelineContext,
    VMAbstraction = require('./VMAbstraction'),
    MUDData = require('../MUDData'),
    MUDModule = require('../MUDModule'),
    fs = require('fs'),
    vm = require('vm');

var
    ExtensionText = MUDData.MasterEFUNS.stripBOM(fs.readFileSync('src/Extensions.js', 'utf8'));

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
        var result = vm.runInContext(context.content, module.context, {
            filename: context.resolvedName,
            lineOffset: 0,
            produceCachedData: false,
            displayErrors: true
        });

        return result;
    }
}

module.exports = VMWrapper;
