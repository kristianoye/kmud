const
    PipelineComponent = require('./PipelineComponent'),
    typescript = require('typescript');

class TypeScriptProcessor extends PipelineComponent {
    constructor(config) {
        super(config);
    }

    runAsync(context) {
        let newSource = typescript.transpile(context.content, {
            target: 'ES2018'
        });
        context.content = newSource;
    }
}

module.exports = TypeScriptProcessor;
