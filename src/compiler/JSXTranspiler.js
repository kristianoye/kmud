const
    PipelineComponent = require('./PipelineComponent'),
    PipeContext = require('./PipelineContext'),
    PipelineContext = PipeContext.PipelineContext,
    acorn = require('acorn-jsx');

const
    IllegalIdentifiers = ['__ala', '__afa'];

class JSXTranspiler extends PipelineComponent {
    /**
     * Run the JSX transpiler.
     * @param {PipelineContext} context
     */
    run(context) {
        var source = context.content;

        if (this.enabled) {
            var ast = acorn.parse(source, { plugins: { jsx: true } }),
                scopes = [],
                jsxDepth = 0,
                jsxIndent = '',
                self = this,
                output = '',
                pos = 0,
                max = source.length;

            function jsxWhitespace(isElement) {
                if (jsxDepth === 0) return '';
                return jsxIndent + Array(jsxDepth + 1).join('   ');
            }

            function createJsxOutput(e) {
                var result = 'false';
                return result;
            }

            function parseElement(e, depth, arg) {
                var ret = '';
                if (!e)
                    return '';
                if (e.start > -1 && e.start > pos) {
                    ret += source.slice(pos, e.start);
                    pos = e.start;
                }
                switch (e.type) {
                    case 'ArrayExpression':
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
                        ret += parseElement(e.body, depth + 1);
                        break;

                    case 'ForStatement':
                        ret += parseElement(e.init, depth + 1);
                        ret += parseElement(e.test, depth + 1);
                        ret += parseElement(e.update, depth + 1);
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
                        let first = e.body.body && e.body.body[0];
                        if (first) {
                            e.body.body.unshift({
                                end: -1,
                                type: 'RuntimeAssertion',
                                start: first.start,
                                text: '__afa(); '
                            });
                        }
                        ret += parseElement(e.body, depth + 1);
                        break;

                    case 'Identifier':
                        let _id = source.slice(e.start, e.end);
                        if (IllegalIdentifiers.indexOf(_id) > -1)
                            throw new Error(`Illegal identifier: ${_id}`);
                        ret += source.slice(_id);
                        pos = e.end;
                        break;

                    case 'IfStatement':
                        ret += parseElement(e.test, depth + 1);
                        ret += parseElement(e.consequent, depth + 1);
                        break;

                    case 'JSXAttribute':
                        pos = e.end;
                        ret += parseElement(e.name, depth + 1);
                        ret += ':';
                        pos = e.value.start;
                        ret += parseElement(e.value, depth + 1);
                        break;

                    case 'JSXClosingElement':
                        ret += ')';
                        pos = e.end;
                        break;

                    case 'JSXElement':
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
                        if (e.name.match(/^[a-z]+/)) {
                            ret += `"${e.name}"`;
                        }
                        else {
                            ret += e.name;
                        }
                        pos = e.end;
                        break;

                    case 'JSXExpressionContainer':
                        pos = e.expression.start;
                        ret += parseElement(e.expression, depth + 1);
                        pos = e.end;
                        break;

                    case 'JSXOpeningElement':
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
                        ret += parseElement(e.value, depth + 1);
                        break;

                    case 'SequenceExpression':
                        e.expressions.forEach(_ => ret += parseElement(_, depth + 1));
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
                        ret += parseElement(e.quasis[0], depth + 1);
                        e.expressions.forEach(_ => ret += parseElement(_, depth + 1));
                        ret += parseElement(e.quasis[1], depth + 1);
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
                        if (e.body.type === 'EmptyStatement' || e.body.body.length === 0) {
                            ret += ') { __ala(); }';
                            pos = e.body.end;
                        }
                        else {
                            e.body.body.unshift({
                                end: -1,
                                type: 'RuntimeAssertion',
                                start: e.body.body[0].start,
                                text: '__ala(); '
                            });
                            ret += parseElement(e.body, depth + 1);
                        }
                        break;

                    default:
                        throw new Error(`Unknown type: ${e.type}`);
                }
                if (e.end !== -1 && pos !== e.end) {
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
