﻿const
    PipelineComponent = require('./PipelineComponent'),
    PipeContext = require('./PipelineContext'),
    PipelineContext = PipeContext.PipelineContext,
    { TimeoutError } = require('../ErrorTypes'),
    acorn = require('acorn-jsx');

const
    IllegalIdentifiers = ['__act', '__ala', '__afa', '__bfc', '__ctx', '__efc'];

/** @typedef {{ allowJsx: boolean, context: PipeContext, source: string }} OpParams */
class JSXTranspilerOp {
    /**
     * Construct a transpiler op
     * @param {OpParams} p The constructor parameters
     */
    constructor(p) {
        this.allowJsx = p.allowJsx;
        this.appendText = '';
        this.ast = acorn.parse(p.source, { plugins: { jsx: true } });
        this.context = p.context;
        this.inClass = false;
        this.jsxDepth = 0;
        this.jsxIndent = '';
        this.max = p.source.length;
        this.output = '';
        this.pos = 0;
        this.scopes = [];
        this.source = p.source;
    }
}

/**
 * Instruments final source code with runtime assertions designed to protect against runaway code.
 * @param {Node} e The node that is being transpiled.
 * @param {string} preText Text inserted before the expression.
 * @param {string} postText Text inserted after the expression.
 * @param {boolean=} isCon Is it a constructor?
 */
function addRuntimeAssert(e, preText, postText, isCon) {
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
                    text: '{ ' + preText + (postText || '') + ' }'
                }
            ]
        };
        e.body = newBody;
    }
    else if (e.body && Array.isArray(e.body.body)) {
        /**
         * @type {any[]}
         */
        let body = e.body.body;
        if (body.length === 0) {
            // TODO: Does an empty block need to be on the stack?
        }
        else {
            let first = body[0], last = body[body.length - 1],
                start = first.start;

            if (first.type === 'DebuggerStatement') {
                let second = body[1];

                e.body.body = body.slice(0, 1).concat([
                    {
                        end: second ? second.start : first.end,
                        type: 'RuntimeAssertion',
                        start: first.end,
                        text: preText
                    }
                ], body.slice(1));
            }
            else if (isCon && first.type === 'ExpressionStatement' &&
                first.expression.type === 'CallExpression' &&
                first.expression.callee.type === 'Super') {
                let second = body[1];

                e.body.body = body.slice(0, 1).concat([
                    {
                        end: second ? second.start : first.end,
                        type: 'RuntimeAssertion',
                        start: first.end,
                        text: preText
                    }
                ], body.slice(1));
            }
            else {
                e.body.body.unshift({
                    end: start,
                    type: 'RuntimeAssertion',
                    start: start,
                    text: preText
                });
            }
            if (postText) {
                e.body.body.push({
                    end: last.end,
                    type: 'RuntimeAssertion',
                    start: last.end,
                    text: postText
                });
            }
        }
    }
}

/**
 * Indent some code
 * @param {JSXTranspilerOp} op The operation
 * @param {boolean} isElement Is the indented item an element
 * @returns {string} The indented code
 */
function jsxWhitespace(op, isElement) {
    if (op.jsxDepth === 0) return '';
    return op.jsxIndent + Array(op.jsxDepth + 1).join('   ');
}

/**
 * Parse a single element and return the transpiled source.
 * @param {JSXTranspilerOp} op The current operation
 * @param {Node} e The current node
 * @param {number} depth The stack depth
 * @param {number} ident The level of indentation
 * @returns {string} The element as source code.
 */
function parseElement(op, e, depth, ident) {
    let ret = '', context = op.context;
    if (e) {
        if (e.start > op.pos) {
            ret += op.source.slice(op.pos, e.start);
            op.pos = e.start;
        }
        switch (e.type) {
            case 'ArrayExpression':
                e.elements.forEach(_ => ret += parseElement(op, _, depth + 1));
                break;

            case 'ArrayPattern':
                e.elements.forEach(_ => ret += parseElement(op, _, depth + 1));
                break;

            case 'ArrowFunctionExpression':
                e.params.forEach(_ => ret += parseElement(op, _, depth + 1));
                ret += parseElement(op, e.body);
                break;

            case 'AssignmentExpression':
                ret += parseElement(op, e.left, depth + 1);
                ret += parseElement(op, e.right, depth + 1);
                break;

            case 'BinaryExpression':
                ret += parseElement(op, e.left, depth + 1);
                ret += parseElement(op, e.right, depth + 1);
                break;

            case 'BlockStatement':
                e.body.forEach(_ => ret += parseElement(op, _, depth + 1));
                break;

            case 'BreakStatement':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                break;

            case 'CallExpression':
                ret += parseElement(op, e.callee, depth + 1);
                e.arguments.forEach(_ => ret += parseElement(op, _, depth + 1));
                break;

            case 'CatchClause':
                ret += parseElement(op, e.param, depth + 1);
                addRuntimeAssert(e, `__act(${e.param.name}); `);
                ret += parseElement(op, e.body, depth + 1);
                break;

            case 'ClassBody':
                op.inClass = true;
                e.body.forEach(_ => ret += parseElement(op, _, depth + 1));
                op.inClass = false;
                break;

            case 'ClassDeclaration':
                ret += parseElement(op, e.id, depth + 1);
                ret += parseElement(op, e.superClass, depth + 1);
                ret += parseElement(op, e.body, depth + 1);
                op.appendText += `\n\n${e.id.name}.prototype.fileName = '${context.basename}';\n`;
                break;

            case 'ConditionalExpression':
                ret += parseElement(op, e.test, depth + 1);
                ret += parseElement(op, e.consequent, depth + 1);
                ret += parseElement(op, e.alternate, depth + 1);
                break;

            case 'ContinueStatement':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                break;

            case 'DebuggerStatement':
                // TODO: Add config check to see if debugger is allowed...
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                break;

            case 'DoWhileStatement':
                addRuntimeAssert(e, '__ala(); ');
                ret += parseElement(op, e.body, depth + 1);
                ret += parseElement(op, e.test, depth + 1);
                break;

            case 'EmptyStatement':
                ret += op.source.slice(op.pos, e.end);
                break;

            case 'ExpressionStatement':
                ret += parseElement(op, e.expression, depth + 1);
                break;

            case 'ForInStatement':
                ret += parseElement(op, e.left, depth + 1);
                ret += parseElement(op, e.right, depth + 1);
                addRuntimeAssert(e, '__ala(); ');
                ret += parseElement(op, e.body, depth + 1);
                break;

            case 'ForStatement':
                ret += parseElement(op, e.init, depth + 1);
                ret += parseElement(op, e.test, depth + 1);
                ret += parseElement(op, e.update, depth + 1);
                addRuntimeAssert(e, '__ala(); ');
                ret += parseElement(op, e.body, depth + 1);
                break;

            case 'FunctionDeclaration':
                ret += parseElement(op, e.id, depth + 1);
                e.params.forEach(_ => ret += parseElement(op, _, depth + 1));
                ret += parseElement(op, e.body, depth + 1, e.id);
                break;

            case 'FunctionExpression':
                ret += parseElement(op, e.id, depth + 1);
                e.params.forEach(_ => ret += parseElement(op, _, depth + 1));
                if (op.inClass) {
                    addRuntimeAssert(e,
                        `let __ctx = __bfc(this, '${ident}'); try { `,
                        ' } finally { __efc(__ctx); }',
                        ident === 'constructor');
                }
                else
                    addRuntimeAssert(e, `__bfc(null); `);
                ret += parseElement(op, e.body, depth + 1);
                break;

            case 'Identifier':
                let _id = op.source.slice(e.start, e.end);
                if (IllegalIdentifiers.indexOf(_id) > -1)
                    throw new Error(`Illegal identifier: ${_id}`);
                ret += _id;
                op.pos = e.end;
                break;

            case 'IfStatement':
                ret += parseElement(op, e.test, depth + 1);
                ret += parseElement(op, e.consequent, depth + 1);
                break;

            case 'JSXAttribute':
                if (!allowJsx)
                    throw new Error(`JSX is not enabled for ${this.extension} files`);
                op.pos = e.end;
                ret += parseElement(op, e.name, depth + 1);
                ret += ':';
                op.pos = e.value.start;
                ret += parseElement(op, e.value, depth + 1);
                break;

            case 'JSXClosingElement':
                if (!allowJsx)
                    throw new Error(`JSX is not enabled for ${this.extension} files`);
                ret += ')';
                op.pos = e.end;
                break;

            case 'JSXElement':
                if (!allowJsx)
                    throw new Error(`JSX is not enabled for ${this.extension} files`);
                if (op.jsxDepth === 0) {
                    var jsxInX = op.source.slice(0, e.start).lastIndexOf('\n') + 1;
                    op.jsxIndent = op.source.slice(jsxInX, e.start);
                }
                ret += jsxWhitespace(op, true) + 'MUD.createElement(\n';
                op.jsxDepth++;
                op.pos = e.start;
                ret += parseElement(op, e.openingElement, depth + 1);
                if (e.children.length > 0) {
                    e.children.forEach(_ => {
                        var t = parseElement(op, _, depth + 1);
                        if (t.length) {
                            ret += ',\n' + (_.type === 'JSXElement' ? '' : jsxWhitespace(op)) + t;
                        }
                    });
                }
                op.pos = e.end;
                ret += e.closingElement ? parseElement(op, e.closingElement) : ')';
                op.jsxDepth--;
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
                op.pos = e.end;
                break;

            case 'JSXExpressionContainer':
                if (!allowJsx)
                    throw new Error(`JSX is not enabled for ${this.extension} files`);
                op.pos = e.expression.start;
                ret += parseElement(op, e.expression, depth + 1);
                op.pos = e.end;
                break;

            case 'JSXOpeningElement':
                if (!allowJsx)
                    throw new Error(`JSX is not enabled for ${this.extension} files`);
                op.pos = e.end;
                ret += jsxWhitespace(op) + parseElement(op, e.name, depth + 1);
                ret += ',\n' + jsxWhitespace(op) + '{';
                e.attributes.forEach((_, i) => {
                    ret += (i > 0 ? ', ' : '') + parseElement(op, _, depth + 1);
                });
                ret += '}';
                op.pos = e.end;
                break;

            case 'JSXText':
                if (!allowJsx)
                    throw new Error(`JSX is not enabled for ${this.extension} files`);
                ret += e.value.trim().length === 0 ? ret : `"${e.raw.replace(/\n/g, '\\n')}"`;
                op.pos = e.end;
                break;

            case 'Literal':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                break;

            case 'LogicalExpression':
                ret += parseElement(op, e.left, depth + 1);
                ret += parseElement(op, e.right, depth + 1);
                break;

            case 'MemberExpression':
                ret += parseElement(op, e.object, depth + 1);
                ret += parseElement(op, e.property, depth + 1);
                break;

            case 'MethodDefinition':
                ret += parseElement(op, e.key, depth + 1);
                ret += parseElement(op, e.value, depth + 1, e.key.name);
                break;

            case 'NewExpression':
                ret += parseElement(op, e.callee, depth + 1);
                e.arguments.forEach(_ => ret += parseElement(op, _, depth + 1));
                break;

            case 'ObjectExpression':
                e.properties.forEach(_ => ret += parseElement(op, _, depth + 1));
                break;

            case 'Property':
                ret += parseElement(op, e.key, depth + 1);
                if (e.key.start !== e.value.start)
                    ret += parseElement(op, e.value, depth + 1);
                break;

            case 'RestElement':
                ret += parseElement(op, e.argument, depth + 1);
                op.pos = e.end;
                break;

            case 'ReturnStatement':
                ret += parseElement(op, e.argument, depth + 1);
                break;

            case 'RuntimeAssertion':
                ret += e.text;
                break;

            case 'SwitchCase':
                ret += parseElement(op, e.test, depth + 1);
                e.consequent.forEach(_ => ret += parseElement(op, _, depth + 1));
                break;

            case 'SequenceExpression':
                e.expressions.forEach(_ => ret += parseElement(op, _, depth + 1));
                break;

            case 'SpreadElement':
                ret += parseElement(op, e.argument, depth + 1);
                break;

            case 'Super':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                break;

            case 'SwitchStatement':
                ret += parseElement(op, e.discriminant, depth + 1);
                e.cases.forEach(_ => ret += parseElement(op, _, depth + 1));
                break;

            case 'TemplateElement':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                break;

            case 'TemplateLiteral':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                //ret += parseElement(op, e.quasis[0], depth + 1);
                //e.expressions.forEach(_ => ret += parseElement(op, _, depth + 1));
                //ret += parseElement(op, e.quasis[1], depth + 1);
                break;

            case 'ThisExpression':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                break;

            case 'ThrowStatement':
                ret += parseElement(op, e.argument, depth + 1);
                break;

            case 'TryStatement':
                ret += parseElement(op, e.block, depth + 1);
                ret += parseElement(op, e.handler, depth + 1);
                ret += parseElement(op, e.finalizer, depth + 1);
                break;

            case 'UnaryExpression':
                ret += parseElement(op, e.argument, depth + 1);
                break;

            case 'UpdateExpression':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                break;

            case 'VariableDeclarator':
                ret += parseElement(op, e.id, depth + 1);
                ret += parseElement(op, e.init, depth + 1);
                break;

            case 'VariableDeclaration':
                e.declarations.forEach(_ => ret += parseElement(op, _, depth + 1));
                break;

            case 'WhileStatement':
                ret += parseElement(op, e.test, depth + 1);
                addRuntimeAssert(e, '__ala(); ');
                ret += parseElement(op, e.body, depth + 1);
                break;

            default:
                throw new Error(`Unknown type: ${e.type}`);
        }
        if (op.pos !== e.end) {
            if (op.pos > e.end) throw new Error('Oops?');
            ret += op.source.slice(op.pos, e.end);
            op.pos = e.end;
        }
    }
    return ret;
}

class JSXTranspiler extends PipelineComponent {
    constructor(config) {
        super(config);
        this.allowJsx = typeof config.allowJsx === 'boolean' ? config.allowJsx : true;
        this.extension = config.extension || '.js';
    }

    /**
     * Run the JSX transpiler.
     * @param {PipelineContext} context The context that is requesting the transpile.
     * @returns {PipelineContext} Returns the context
     */
    run(context) {
        let op = new JSXTranspilerOp({
            allowJsx: this.allowJsx,
            context,
            source: context.content
        });
        try {
            if (this.enabled) {
                op.ast.body.forEach((n, i) => op.output += parseElement(op, n, 0));
                if (op.pos < op.max) op.output += op.source.slice(op.pos, op.max);
                return context.update(PipeContext.CTX_RUNNING, op.output + op.appendText);
            }
        }
        catch (x) {
            console.log(x.message);
            console.log(x.stack);
            throw x;
        }
    }
}

module.exports = JSXTranspiler;
