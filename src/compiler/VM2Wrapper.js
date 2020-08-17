const
    { NodeVM, VMScript } = require('vm2'),
    PipelineContext = require('./PipelineContext').PipelineContext,
    VMAbstraction = require('./VMAbstraction'),
    path = require('path');

class VM2Wrapper extends VMAbstraction {
    constructor() {
        super();
        throw new Error('KMUD Does Not Currently Work With VM2');
    }

    /**
     * Load an object in its own virtual sandbox;

     * @param {PipelineContext} context The compiler context.
     * @param {MUDModule} module The module being loaded.
     */
    run(context, module) {
        var script = new VMScript(context.content, context.resolvedName);
        var vm = new NodeVM({
            console: 'inherit',
            sandbox: module.loader,
            require: {
                external: false,
                root: driver.config.mudlib.baseDirectory
            },
            nesting: true,
            wrapper: 'none'
        });
        var result = vm.run(context.content);
        return result;
    }
}

module.exports = new VM2Wrapper();
