/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * TODO: Merge added functionality back into original JSXTranspiler
 */
const
    PipelineComponent = require('./PipelineComponent'),
    PipeContext = require('./PipelineContext'),
    SettersGetters = [
        'get',          // Get a value
        'register',     // Initialize but do not overwrite
        'set'           // Sets a value
    ],
    acorn = require('acorn'),
    modifiers = require('./SecurityModifiers'),
    jsx = require('acorn-jsx');

const
    //  These cannot be used as identifiers (reserved words)
    IllegalIdentifiers = [
        '__act',
        '__ada',
        '__ala',
        '__afa',
        '__bfc',    // Begin Function Call
        '__efc',    // End Function Call
        '__rmt',    // Reset Module Types
        '__dmt',    // Define Module Type
        '__iac',
        '__dac',
        '__pcc',    // Perform Constructor Call
        '__mec'     // MUD Execution Context 
    ],

    //  These methods cannot be defined by objects in the game
    ProtectedApplies = ['setPrivate', 'getPrivate', 'setProtected', 'getProtected'];

var nextAsyncHandleId = 1;

/**
 * Fetch the next async handle ID to use 
 * @returns {number} The next async handle to use
 */
function getAsyncHandleId() {
    // We could use UUID and never have to worry?
    if (nextAsyncHandleId === Number.MAX_SAFE_INTEGER)
        nextAsyncHandleId = 1;
    return nextAsyncHandleId++;
}

/** @typedef {{ allowJsx: boolean, context: PipeContext, source: string }} OpParams */
class JSXTranspilerOp {
    /**
     * Construct a transpiler op
     * @param {OpParams} p The constructor parameters
     */
    constructor(p) {
        this.acornOptions = p.acornOptions || false;
        this.allowLiteralCallouts = p.allowLiteralCallouts;
        this.allowJsx = p.allowJsx;

        this.appendText = '';
        if (!this.acornOptions) {
            this.ast = p.allowJsx ?
                acorn.Parser
                    .extend(jsx())
                    .extend(modifiers({ allowAccessModifiers: true }))
                    .parse(p.source, acornOptions) :
                acorn.Parser
                    .extend(modifiers({ allowAccessModifiers: true }))
                    .parse(p.source, acornOptions);
        }
        this.callerId = [];
        this.context = p.context;
        this.filename = p.filename;
        this.filepart = p.filename.slice(p.filename.lastIndexOf('/') + 1);
        this.jsxDepth = 0;
        this.jsxIndent = '';
        this.max = p.source.length;
        this.output = '';
        this.pos = 0;
        this.scopes = [];
        this.source = p.source;

        this.thisAccess = "public";
        this.thisClass = false;
        this.thisMethod = false;
        this.thisParameter = false;
        this.isStatic = false;
    }

    /**
     * 
     * @param {string} id
     */
    addCallerId(id) {
        id = id.trim();
        if (id.charAt(0) === '.')
            id = id.slice(1);
        return this.callerId.push(id);
    }

    /**
     * Free up memory and return content
     * @returns {string} The transpiled source
     */
    finish() {
        try {
            this.callerId = false;
            this.source = false;
            this.max = -1;
            return this.output + this.appendText;
        }
        finally {
            this.output = false;
            this.appendText = false;
        }
    }

    eatWhitespace() {
        while (this.pos < this.max && this.source.charAt(this.pos).trim() === '')
            this.pos++;
    }

    /**
     * Creates a unique filename for a class
     * @param {string} className The name of the class being defined
     * @returns {string} Returns a string representing the module path + class
     */
    getBaseName(className) {
        if (this.filepart === className)
            return this.filename;
        else
            return `${this.filename}$${className}`;
    }

    getCallerId() {
        return this.callerId.pop();
    }

    get method() {
        return this.thisMethod || '(MAIN)';
    }

    /**
     * Read from the buffer from current position to specified index.
     * @param {number} index The index to read to
     * @param {boolean} peekOnly If true then the position remains unchanged
     * @returns {string} Returns the specified region of the buffer.
     */
    readUntil(index = 0, peekOnly = false) {
        if (index <= this.pos)
            return '';
        let result = this.source.slice(this.pos, index);
        if (peekOnly !== true) this.pos = index;
        return result;
    }

    setMethod(s, access = "public", isStatic = false) {
        this.thisAccess = access || "public";
        this.thisMethod = s || false;
        this.thisParameter = this.thisClass ? `this || ${this.thisClass}` : 'this';
        this.isStatic = isStatic === true;
        return this.thisMethod;
    }
}

/** 
 *  A superset of all possible node properties.  Should separate into 
 *  individual jsdoc types at some point...
 *  
 * @typedef {Object} NodeType
 * @property {NodeType|NodeType[]} [body] A body node.
 * @property {NodeType} [callee] The target of a method call operation.
 * @property {number} end The ending character index for the node (and all children)
 * @property {NodeType[]} [elements] An array of element nodes.
 * @property {NodeType} [left] The left side of a statement.
 * @property {NodeType[]} [param] 
 * @property {NodeType[]} [params] Parameters to a function or method call.
 * @property {NodeType} [right] THe right side of an assignment operation.
 * @property {number} start The starting character index for the node.
 * @property {NodeType} [test] The test expression for an operation.
 * @property {string} [text] The text representation of the node.
 * @property {string} type The type of node
 */

/**
 * Instruments final source code with runtime assertions designed to protect against runaway code.
 * @param {NodeType} e The node that is being transpiled.
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
 * @returns {string} The indented code
 */
function jsxWhitespace(op) {
    if (op.jsxDepth === 0) return '';
    return op.jsxIndent + Array(op.jsxDepth + 1).join('   ');
}

/**
 * Parse a single element and return the transpiled source.
 * @param {JSXTranspilerOp} op The current operation
 * @param {NodeType} e The current node
 * @param {number} depth The stack depth
 * @returns {string} The element as source code.
 */
function parseElement(op, e, depth) {
    let ret = '';
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
                {
                    let funcName = `${op.getCallerId() || '(anonymous)'}(() => {})`;
                    e.params.forEach(_ => ret += parseElement(op, _, depth + 1));
                    ret += op.readUntil(e.body.start);
                    if (e.body.type === 'BlockStatement') {
                        ret += `{ let __mec = __bfc(${op.thisParameter}, false, '${funcName}', __FILE__, ${e.async}); try `;
                        ret += parseElement(op, e.body);
                        ret += ` finally { __efc(__mec, '${funcName}'); } }`;
                    }
                    else if (e.body.type === 'MemberExpression') {
                        ret += `{ let __mec = __bfc(${op.thisParameter}, false, '${funcName}', __FILE__, ${e.async}); try { return `;
                        ret += parseElement(op, e.body);
                        ret += `; } finally { __efc(__mec, '${funcName}'); } }`;
                    }
                    else {
                        ret += `{ let __mec = __bfc(${op.thisParameter}, false, '${funcName}', __FILE__, ${e.async}); try { return (`;
                        ret += parseElement(op, e.body);
                        ret += `); } finally { __efc(__mec, '${funcName}'); } }`;
                    }
                }
                break; 

            case 'AssignmentExpression':
                ret += parseElement(op, e.left, depth + 1);
                ret += parseElement(op, e.right, depth + 1);
                break;

            case 'AwaitExpression':
                {
                    /**
                     * This block needs some love to be really bulletproof:
                     *   (1) Need different or rolling async handles for
                     *       long-running utimes,
                     *       
                     *   (2) Need foolproof wrapper to ensure context cannot
                     *       outlive the async call,
                     *       
                     *   (3) Need to safeguard against users calling async
                     *       methods without using await.
                     */
                    let handleId = getAsyncHandleId(); 
                    ret += `(__iac(this, ${handleId}, '${op.method}', __FILE__), `;
                    ret += parseElement(op, e.argument, depth + 1);
                    ret += `.always(() => __dac(${handleId})))`;
                    
                }
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
                {
                    let writeCallee = true,
                        isCallout = false,
                        object = false,
                        propName = false,
                        callee = false;

                    if (e.callee.type === 'MemberExpression') {
                        object = parseElement(op, e.callee.object, depth + 1);
                        propName = parseElement(op, e.callee.property, depth + 1);
                        callee = object + propName;
                        op.addCallerId(propName.slice(1));
                    }
                    else if (e.callee.type === 'Identifier') {
                        propName = callee = parseElement(op, e.callee, depth + 1);
                        if (SettersGetters.indexOf(propName) > -1) {
                            if (!op.thisClass)
                                throw new Error(`The ${propName} operator can only be used inside a class.`);

                            // set.call(this, ... args)
                            ret += propName;
                            ret += `.call(this, ${op.thisClass}, `
                            if (e.arguments.length > 0) {
                                let unusedText = op.readUntil(e.arguments[0].start);
                            }
                            e.arguments.forEach(_ => ret += parseElement(op, _, depth + 1));
                            ret += op.readUntil(e.end);
                            isCallout = true;
                            writeCallee = false;
                        }
                        else
                            op.addCallerId(propName);
                    }
                    else if (e.callee.type === 'Super') {
                        propName = callee = parseElement(op, e.callee, depth + 1);
                        op.addCallerId(propName);
                    }
                    else if (e.callee.type === 'FunctionExpression') {
                        propName = callee = parseElement(op, e.callee, depth + 1);
                        op.addCallerId('function()');
                    }
                    else if (e.callee.type === 'ArrowFunctionExpression') {
                        propName = callee = parseElement(op, e.callee, depth + 1);
                        op.addCallerId('() => {}');
                    }
                   else {
                        throw new Error(`Unexpected callee type ${e.callee.type}`);
                    }
                    if (op.allowLiteralCallouts) {
                        if (e.callee && e.callee.type === 'MemberExpression') {
                            let objectType = e.callee.object.type;
                            if (objectType === 'Literal' || objectType === 'MemberExpression') {
                                let isString = false;
                                try {
                                    isString = typeof eval(object) === 'string';
                                }
                                catch (e) { /* do nothing */ }

                                if (typeof String.prototype[propName] !== 'function') {
                                    let args = '';
                                    ret += `typeof ${object} === 'string' && typeof String.prototype${propName} !== 'function' && unwrap(efuns.loadObjectSync(${object}), o => o${propName}`;
                                    e.arguments.forEach(_ => args += parseElement(op, _, depth + 1));
                                    args += op.source.slice(op.pos, e.end);
                                    ret += `${args}) || (() => ${object}${propName}${args})()`; // Close out the wrap
                                    isCallout = true;
                                    op.pos = e.end;
                                } else {
                                    ret += object;
                                    ret += propName;
                                }
                                writeCallee = false;
                            }
                        }
                    }
                    if (writeCallee)
                        ret += callee;
                    if (!isCallout)
                        e.arguments.forEach(_ => ret += parseElement(op, _, depth + 1));
                }
                break;

            case 'CatchClause':
                ret += parseElement(op, e.param, depth + 1);
                addRuntimeAssert(e, `__act(${e.param.name}); `);
                ret += parseElement(op, e.body, depth + 1);
                break;

            case 'ClassBody':
                e.body.forEach(_ => ret += parseElement(op, _, depth + 1));
                op.thisClass = false;
                break;

            case 'ClassDeclaration':
                op.thisClass = e.id.name;
                ret += parseElement(op, e.id, depth + 1);
                if (e.superClass)
                    ret += parseElement(op, e.superClass, depth + 1);
                else if (op.injectedSuperClass)
                    ret += ` extends ${op.injectedSuperClass}`;
                ret += parseElement(op, e.body, depth + 1);
                ret += ` ${e.id.name}.prototype.baseName = '${op.getBaseName(e.id.name)}'; __dmt("${op.filename}", ${e.id.name}); `;
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
                {
                    let functionName = e.id.name; 
                    if (IllegalIdentifiers.indexOf(functionName) > -1)
                        throw new Error(`Illegal function name: ${functionName}`);
                    else if (SettersGetters.indexOf(functionName) > -1)
                        throw new Error(`Illegal function name: ${functionName}`);
                    ret += parseElement(op, e.id, depth + 1);
                    e.params.forEach(_ => ret += parseElement(op, _, depth + 1));
                    if (op.thisClass) {
                        addRuntimeAssert(e,
                            `let __mec = __bfc(${op.thisParameter}, 'public', '${e.id.name}', __FILE__, false); try { `,
                            ` } finally { __efc(__mec, '${e.id.name}'); }`);
                    }
                    else
                        addRuntimeAssert(e,
                            `let __mec = __bfc(this, 'public', '${e.id.name}', __FILE__, false); try { `,
                            ` } finally { __efc(__mec, '${e.id.name}'); }`);
                    ret += parseElement(op, e.body, depth + 1, e.id);
                }
                break;

            case 'FunctionExpression':
                {
                    ret += parseElement(op, e.id, depth + 1);
                    e.params.forEach(_ => ret += parseElement(op, _, depth + 1));
                    if (op.thisClass && op.thisMethod) {
                        addRuntimeAssert(e,
                            `let __mec = __bfc(${op.thisParameter}, '${op.thisAccess}', '${op.thisMethod}', __FILE__, false); try { `,
                            ` } finally { __efc(__mec, '${op.method}'); }`,
                            op.method === 'constructor');
                    }
                    ret += parseElement(op, e.body, depth + 1);
                }
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
                // BUG: Wow alternates were not being processed at all.
                if (e.alternate) ret += parseElement(op, e.alternate);
                break;

            case 'JSXAttribute':
                if (!op.allowJsx)
                    throw new Error(`JSX is not enabled for ${this.extension} files`);
                op.pos = e.end;
                ret += parseElement(op, e.name, depth + 1);
                ret += ':';
                op.pos = e.value.start;
                ret += parseElement(op, e.value, depth + 1);
                break;

            case 'JSXClosingElement':
                if (!op.allowJsx)
                    throw new Error(`JSX is not enabled for ${this.extension} files`);
                ret += ')';
                op.pos = e.end;
                break;

            case 'JSXElement':
                if (!op.allowJsx)
                    throw new Error(`JSX is not enabled for ${op.context.extension} files`);
                if (op.jsxDepth === 0) {
                    var jsxInX = op.source.slice(0, e.start).lastIndexOf('\n') + 1;
                    op.jsxIndent = ' '.repeat(e.start - jsxInX);
                }
                ret += jsxWhitespace(op, true) + 'createElement(';
                op.pos = e.start;
                ret += parseElement(op, e.openingElement, depth + 1);
                if (e.children.length > 0) {
                    e.children.forEach((_, i) => {
                        if(i === 1) op.jsxDepth++;
                        let t = parseElement(op, _, depth + 1);
                        if (t.length) {
                            ret += ', ' + (_.type === 'JSXElement' ? '' : jsxWhitespace(op)) + t;
                        }
                    });
                }
                op.pos = e.end;
                ret += e.closingElement ? parseElement(op, e.closingElement) : ')';
                op.jsxDepth--;
                break;

            case 'JSXIdentifier':
                if (!op.allowJsx)
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
                if (!op.allowJsx)
                    throw new Error(`JSX is not enabled for ${this.extension} files`);
                op.pos = e.expression.start;
                ret += parseElement(op, e.expression, depth + 1);
                op.pos = e.end;
                break;

            case 'JSXOpeningElement':
                if (!op.allowJsx)
                    throw new Error(`JSX is not enabled for ${this.extension} files`);
                op.pos = e.end;
                ret += parseElement(op, e.name, depth + 1);
                ret += ', {';
                e.attributes.forEach((_, i) => {
                    ret += (i > 0 ? ', ' : '') + parseElement(op, _, depth + 1);
                });
                ret += '}';
                op.pos = e.end;
                break;

            case 'JSXText':
                if (!op.allowJsx)
                    throw new Error(`JSX is not enabled for ${this.extension} files`);
                ret += e.value.trim().length === 0 ? ret : `"${e.raw.replace(/([\r\n]+)/g, "\\$1")}"`;
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
                {
                    ret += parseElement(op, e.object, depth + 1);
                    ret += parseElement(op, e.property, depth + 1);
                }
                break;

            case 'MethodDefinition':
                if (e.access) {
                    op.pos = e.access.end;
                    op.eatWhitespace();
                }
                let methodName = op.setMethod(parseElement(op, e.key, depth + 1), e.accessKind, e.static);
                if (ProtectedApplies.indexOf(methodName) > -1) {
                    throw new Error(`Type '${op.thisClass}' attempts to redefine protected apply '${methodName}' in ${op.filename}`);
                }
                ret += methodName;
                ret += parseElement(op, e.value, depth + 1, methodName);
                op.setMethod();
                break;

            case 'NewExpression':
                {
                    let callee = op.source.slice(e.callee.start, e.callee.end);
                    op.pos = e.callee.end;
                    ret += `__pcc(${op.thisParameter}, ${callee}, __FILE__, '${op.method}', ct => new ct`;
                    e.arguments.forEach(_ => ret += parseElement(op, _, depth + 1));
                    if (op.pos !== e.end) {
                        if (op.pos > e.end) throw new Error('Oops?');
                        ret += op.source.slice(op.pos, e.end);
                        op.pos = e.end;
                    }
                    ret += ')';
                }
                break;

            case 'ObjectExpression':
                e.properties.forEach(_ => ret += parseElement(op, _, depth + 1));
                break;

            case 'ObjectPattern':
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
                {
                    let items = []
                        .concat(e.quasis.slice(0), e.expressions.slice(0))
                        .sort((a, b) => a.start < b.start ? -1 : a.start === b.start ? 0 : 1);
                    items.forEach(_ => ret += parseElement(op, _, depth + 1));
                }
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

            case 'WithStatement':
                ret += parseElement(op, e.object, depth + 1);
                ret += parseElement(op, e.body, depth + 1);
                break;

            default:
                throw new Error(`Unknown type: ${e.type}`);
        }
        if (op.pos !== e.end) {
            if (op.pos > e.end) throw new Error('Oops?');

            // this should be done by each type so we are sure we aren't missing something
            ret += op.readUntil(e.end);
        }
    }
    return ret;
}

class JSXTranspilerForAcornJsx5 extends PipelineComponent {
    constructor(config) {
        super(config);

        this.acornOptions = Object.assign({}, config.acornOptions);
        this.acornOptions.onComment = (block, text, start, end) => {
            /* TODO: do autodoc stuff */
            let len = end - start;
        };

        this.allowJsx = typeof config.allowJsx === 'boolean' ? config.allowJsx : true;
        this.allowLiteralCallouts = typeof config.allowLiteralCallouts === 'boolean' ? config.allowLiteralCallouts : true;
        this.extension = config.extension || '.js';
        this.parser = acorn.Parser
            .extend(jsx())
            .extend(modifiers(config));

    }

    run(context) {
        let op = new JSXTranspilerOp({
            acornOptions: Object.assign({}, this.acornOptions, context.acornOptions),
            allowJsx: this.allowJsx,
            allowLiteralCallouts: this.allowLiteralCallouts,
            filename: context.basename,
            context,
            source: context.content
        });
        try {
            if (this.enabled) {
                op.ast = this.parser.parse(op.source, op.acornOptions);
                op.output += `__rmt("${op.filename}");`
                op.ast.body.forEach(n => op.output += parseElement(op, n, 0));
                op.output += op.readUntil(op.max);
                op.output += op.appendText;
                return context.update(PipeContext.CTX_RUNNING, op.finish());
            }
        }
        catch (x) {
            console.log(x.message);
            console.log(x.stack);
            throw x;
        }
    }
}

module.exports = JSXTranspilerForAcornJsx5;
