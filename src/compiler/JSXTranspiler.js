const
    PipelineComponent = require('./PipelineComponent'),
    PipeContext = require('./PipelineContext'),
    PipelineContext = PipeContext.PipelineContext,
    { TimeoutError } = require('../ErrorTypes'),
    acorn = require('acorn-jsx');

const
    IllegalIdentifiers = ['__act', '__ala', '__afa'];

class JSXTranspiler extends PipelineComponent {
    constructor(config) {
        super(config);
        this.allowJsx = typeof config.allowJsx === 'boolean' ? config.allowJsx : true;
        this.extension = config.extension || '.js';
    }

    /**
     * Run the JSX transpiler.
     * @param {PipelineContext} context
     */
    run(context) {
        let source = context.content,
            allowJsx = this.allowJsx;

        if (this.enabled) {
            var ast = acorn.parse(source, { plugins: { jsx: true } }),
                scopes = [],
                jsxDepth = 0,
                jsxIndent = '',
                self = this,
                output = '',
                pos = 0,
                max = source.length;

            /**
             * Instruments final source code with runtime assertions
             * designed to protect against runaway code.
             * @param {Node} e
             * @param {string} assertText
             */
            function addRuntimeAssert(e, assertText) {
                let foo = source.slice(e.start, e.end),
                    bod = e.body ? source.slice(e.body.start, e.body.end) : false;
                if (e.body.type === 'EmptyStatement') {
                    let newBody = {
                        type: 'BlockStatement',
                        start: e.body.start,
                        end: e.body.end,
                        body: [
                            {
                                start: e.body.start,
                                end: e.body.end,
                                type: 'RuntimeAssertion',
                                text: '{ ' + assertText + ' }'
                            }
                        ]
                    };
                    e.body = newBody;
                }
                else {
                    let first = e.body.body[0] || false,
                        start = first ? first.start : e.body.start + 1;

                    e.body.body.unshift({
                        end: start,
                        type: 'RuntimeAssertion',
                        start: start,
                        text: assertText
                    });
                }
            }

            function jsxWhitespace(isElement) {
                if (jsxDepth === 0) return '';
                return jsxIndent + Array(jsxDepth + 1).join('   ');
            }

            function createJsxOutput(e) {
                var result = 'false';
                return result;
            }

            function parseElement(e, depth) {
                var ret = '';
                if (!e)
                    return '';
                //let
                //    foo = e ? source.slice(e.start, e.end) : '';

                if (e.start > pos) {
                    ret += source.slice(pos, e.start);
                    pos = e.start;
                }
                switch (e.type) {
                    case 'ArrayExpression':
                        e.elements.forEach(_ => ret += parseElement(_, depth + 1));
                        break;

                    case 'ArrayPattern':
                        e.elements.forEach(_ => ret += parseElement(_, depth + 1));
                        break;

                    case 'ArrowFunctionExpression':
                        e.params.forEach(_ => ret += parseElement(_, depth + 1));
                        ret += parseElement(e.body);
                        break;

                    case 'AssignmentExpression':
                        ret += parseElement(e.left, depth + 1);
                        ret += parseElement(e.right, depth + 1);
                        break;

                    case 'BinaryExpression':
                        ret += parseElement(e.left, depth + 1);
                        ret += parseElement(e.right, depth + 1);
                        break;

                    case 'BlockStatement':
                        e.body.forEach(_ => ret += parseElement(_, depth + 1));
                        break;

                    case 'BreakStatement':
                        ret += source.slice(e.start, e.end);
                        pos = e.end;
                        break;

                    case 'CallExpression':
                        ret += parseElement(e.callee, depth + 1);
                        e.arguments.forEach(_ => ret += parseElement(_, depth + 1));
                        break;

                    case 'CatchClause':
                        ret += parseElement(e.param, depth + 1);
                        addRuntimeAssert(e, `__act(${e.param.name}); `);
                        ret += parseElement(e.body, depth + 1);
                        break;

                    case 'ClassBody':
                        e.body.forEach(_ => ret += parseElement(_, depth + 1));
                        break;

                    case 'ClassDeclaration':
                        ret += parseElement(e.id, depth + 1);
                        ret += parseElement(e.superClass, depth + 1);
                        ret += parseElement(e.body, depth + 1);
                        break;

                    case 'ConditionalExpression':
                        ret += parseElement(e.test, depth + 1);
                        ret += parseElement(e.consequent, depth + 1);
                        ret += parseElement(e.alternate, depth + 1);
                        break;

                    case 'ContinueStatement':
                        ret += source.slice(e.start, e.end);
                        pos = e.end;
                        break;

                    case 'DoWhileStatement':
                        addRuntimeAssert(e, '__ala(); ');
                        ret += parseElement(e.body, depth + 1);
                        ret += parseElement(e.test, depth + 1);
                        break;

                    case 'EmptyStatement':
                        ret += source.slice(pos, e.end);
                        break;

                    case 'ExpressionStatement':
                        ret += parseElement(e.expression, depth + 1);
                        break;

                    case 'ForInStatement':
                        ret += parseElement(e.left, depth + 1);
                        ret += parseElement(e.right, depth + 1);
                        addRuntimeAssert(e, '__ala(); ');
                        ret += parseElement(e.body, depth + 1);
                        break;

                    case 'ForStatement':
                        ret += parseElement(e.init, depth + 1);
                        ret += parseElement(e.test, depth + 1);
                        ret += parseElement(e.update, depth + 1);
                        addRuntimeAssert(e, '__ala(); ');
                        ret += parseElement(e.body, depth + 1);
                        break;

                    case 'FunctionDeclaration':
                        ret += parseElement(e.id, depth + 1);
                        e.params.forEach(_ => ret += parseElement(_, depth + 1));
                        ret += parseElement(e.body, depth + 1);
                        break;

                    case 'FunctionExpression':
                        ret += parseElement(e.id, depth + 1);
                        e.params.forEach(_ => ret += parseElement(_, depth + 1));
                        addRuntimeAssert(e, '__afa(); ');
                        ret += parseElement(e.body, depth + 1);
                        break;

                    case 'Identifier':
                        let _id = source.slice(e.start, e.end);
                        if (IllegalIdentifiers.indexOf(_id) > -1)
                            throw new Error(`Illegal identifier: ${_id}`);
                        ret += _id;
                        pos = e.end;
                        break;

                    case 'IfStatement':
                        ret += parseElement(e.test, depth + 1);
                        ret += parseElement(e.consequent, depth + 1);
                        break;

                    case 'JSXAttribute':
                        if (!allowJsx)
                            throw new Error(`JSX is not enabled for ${this.extension} files`);
                        pos = e.end;
                        ret += parseElement(e.name, depth + 1);
                        ret += ':';
                        pos = e.value.start;
                        ret += parseElement(e.value, depth + 1);
                        break;

                    case 'JSXClosingElement':
                        if (!allowJsx)
                            throw new Error(`JSX is not enabled for ${this.extension} files`);
                        ret += ')';
                        pos = e.end;
                        break;

                    case 'JSXElement':
                        if (!allowJsx)
                            throw new Error(`JSX is not enabled for ${this.extension} files`);
                        if (jsxDepth === 0) {
                            var jsxInX = source.slice(0, e.start).lastIndexOf('\n') + 1;
                            jsxIndent = source.slice(jsxInX, e.start);
                        }
                        ret += jsxWhitespace(true) + 'MUD.createElement(\n';
                        jsxDepth++;
                        pos = e.start;
                        ret += parseElement(e.openingElement, depth + 1);
                        if (e.children.length > 0) {
                            e.children.forEach(_ => {
                                var t = parseElement(_, depth + 1);
                                if (t.length) {
                                    ret += ',\n' + (_.type === 'JSXElement' ? '' : jsxWhitespace()) + t;
                                }
                            });
                        }
                        pos = e.end;
                        ret += e.closingElement ? parseElement(e.closingElement) : ')';
                        jsxDepth--;
                        break;

                    case 'JSXIdentifier':
                        if (!allowJsx)
                            throw new Error(`JSX is not enabled for ${this.extension} files`);
                        if (e.name.match(/^[a-z]+/)) {
                            ret += `"${e.name}"`;
                        }
                        else {
                            ret += e.name;
                        }
                        pos = e.end;
                        break;

                    case 'JSXExpressionContainer':
                        if (!allowJsx)
                            throw new Error(`JSX is not enabled for ${this.extension} files`);
                        pos = e.expression.start;
                        ret += parseElement(e.expression, depth + 1);
                        pos = e.end;
                        break;

                    case 'JSXOpeningElement':
                        if (!allowJsx)
                            throw new Error(`JSX is not enabled for ${this.extension} files`);
                        pos = e.end;
                        ret += jsxWhitespace() + parseElement(e.name, depth + 1);
                        ret += ',\n' + jsxWhitespace() + '{';
                        e.attributes.forEach((_, i) => {
                            ret += (i > 0 ? ', ' : '') + parseElement(_, depth + 1);
                        });
                        ret += '}'
                        pos = e.end;
                        break;

                    case 'JSXText':
                        if (!allowJsx)
                            throw new Error(`JSX is not enabled for ${this.extension} files`);
                        ret += e.value.trim().length === 0 ? ret : `"${e.raw.replace(/\n/g, '\\n')}"`;
                        pos = e.end;
                        break;

                    case 'Literal':
                        ret += source.slice(e.start, e.end);
                        pos = e.end;
                        break;

                    case 'LogicalExpression':
                        ret += parseElement(e.left, depth + 1);
                        ret += parseElement(e.right, depth + 1);
                        break;

                    case 'MemberExpression':
                        ret += parseElement(e.object, depth + 1);
                        ret += parseElement(e.property, depth + 1);
                        break;

                    case 'MethodDefinition':
                        ret += parseElement(e.key, depth + 1);
                        ret += parseElement(e.value, depth + 1);
                        break;

                    case 'NewExpression':
                        ret += parseElement(e.callee, depth + 1);
                        e.arguments.forEach(_ => ret += parseElement(_, depth + 1));
                        break;

                    case 'ObjectExpression':
                        e.properties.forEach(_ => ret += parseElement(_, depth + 1));
                        break;

                    case 'Property':
                        ret += parseElement(e.key, depth + 1);
                        if (e.key.start !== e.value.start)
                            ret += parseElement(e.value, depth + 1);
                        break;

                    case 'RestElement':
                        ret += parseElement(e.argument, depth + 1);
                        pos = e.end;
                        break;

                    case 'ReturnStatement':
                        ret += parseElement(e.argument, depth + 1);
                        break;

                    case 'RuntimeAssertion':
                        ret += e.text;
                        break;

                    case 'SwitchCase':
                        ret += parseElement(e.test, depth + 1);
                        e.consequent.forEach(_ => ret += parseElement(_, depth + 1));
                        break;

                    case 'SequenceExpression':
                        e.expressions.forEach(_ => ret += parseElement(_, depth + 1));
                        break;

                    case 'SpreadElement':
                        ret += parseElement(e.argument, depth + 1);
                        break;

                    case 'Super':
                        ret += source.slice(e.start, e.end);
                        pos = e.end;
                        break;

                    case 'SwitchStatement':
                        ret += parseElement(e.discriminant, depth + 1);
                        e.cases.forEach(_ => ret += parseElement(_, depth + 1));
                        break;

                    case 'TemplateElement':
                        ret += source.slice(e.start, e.end);
                        pos = e.end;
                        break;

                    case 'TemplateLiteral':
                        ret += source.slice(e.start, e.end);
                        pos = e.end;
                        //ret += parseElement(e.quasis[0], depth + 1);
                        //e.expressions.forEach(_ => ret += parseElement(_, depth + 1));
                        //ret += parseElement(e.quasis[1], depth + 1);
                        break;

                    case 'ThisExpression':
                        ret += source.slice(e.start, e.end);
                        pos = e.end;
                        break;

                    case 'ThrowStatement':
                        ret += parseElement(e.argument, depth + 1);
                        break;

                    case 'TryStatement':
                        ret += parseElement(e.block, depth + 1);
                        ret += parseElement(e.handler, depth + 1);
                        ret += parseElement(e.finalizer, depth + 1);
                        break;

                    case 'UnaryExpression':
                        ret += parseElement(e.argument, depth + 1);
                        break;

                    case 'UpdateExpression':
                        ret += source.slice(e.start, e.end);
                        pos = e.end;
                        break;

                    case 'VariableDeclarator':
                        ret += parseElement(e.id, depth + 1);
                        ret += parseElement(e.init, depth + 1);
                        break;

                    case 'VariableDeclaration':
                        e.declarations.forEach(_ => ret += parseElement(_, depth + 1));
                        break;

                    case 'WhileStatement':
                        ret += parseElement(e.test, depth + 1);
                        addRuntimeAssert(e, '__ala(); ');
                        ret += parseElement(e.body, depth + 1);
                        break;

                    default:
                        throw new Error(`Unknown type: ${e.type}`);
                }
                if (pos !== e.end) {
                    if (pos > e.end) throw new Error('Oops?');
                    ret += source.slice(pos, e.end);
                    pos = e.end;
                }
                return ret;
            }

            ast.body.forEach((n, i) => output += parseElement(n, 0));
            if (pos < max) output += source.slice(pos, max);
            return context.update(PipeContext.CTX_RUNNING, output);
        }
    }
}

module.exports = JSXTranspiler;
