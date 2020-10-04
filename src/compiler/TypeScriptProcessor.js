const
    PipelineComponent = require('./PipelineComponent'),
    ts = require('typescript');

/**
 * 
 * @param {ts.CompilerOptions} options
 */
function transpile(options) {
    /**
     * 
     * @param {ts.TransformationContext} ctx
     * @param {ts.SourceFile} sf 
     */
    function visitor(ctx, sf) {
        const visitor = (node) => {
            return ts.visitEachChild(node, visitor, ctx);
        };
    }
}

class TypeScriptProcessor extends PipelineComponent {
    constructor(config) {
        super(config);
    }

    runAsync(context) {
        let newSource = ts.transpile(context.content, {
            target: 'ES2018'
        });
        context.content = newSource;
    }
}

module.exports = TypeScriptProcessor;
