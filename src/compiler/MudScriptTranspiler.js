﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    PipelineComponent = require('./PipelineComponent'),
    PipeContext = require('./PipelineContext'),
    MUDCompilerOptions = require('./MUDCompilerOptions'),
    SettersGetters = [
        'del',          // Delete a value
        'get',          // Get a value
        'inc',          // Increment a value
        'set'           // Sets a value
    ],
    acorn = require('acorn'),
    MudscriptAcornPlugin = require('./MudscriptAcornPlugin'),
    jsx = require('acorn-jsx'),
    { CallOrigin, ExecutionContext } = require('../ExecutionContext'),
    MemberModifiers = require("./MudscriptMemberModifiers"),
    { SyntaxError, SyntaxWarning, CompositeError } = require('../ErrorTypes'),
    PipelineContext = PipeContext.PipelineContext;

const
    //  These cannot be used as identifiers (reserved words)
    IllegalIdentifiers = [
        //  Use 'parameters' instead
        'arguments',

        //  Property indicating whether an object is destroyed
        'destructed',

        //  Prohited JavaScript patterns
        'apply',
        'bind',
        'call',

        //  Create efuns
        '__cef',

        //  Async-related reserved tokens
        '__acb',    // Async Callback
        '__aeh',    // Async Error Handler
        '__acr',    // Async Call Result
        '__ahi',    // Async Handle ID

        //  Error handling
        '__cat',    // Catch Error

        //  Execution Time Assertions
        '__ala',    // Assert Loop Alarm
        '__asi',    // Assert Safe Index

        //  Method/Function execution
        '__bfc',    // Begin Function Call
        '__efc',    // End Function Call

        //  Module definition control
        '__rmt',    // Reset Module Types - Called during compiling to reset manifest
        '__dmt',    // Define Module Type - Define a type in a module

        //  Constructor call
        '__pcc',    // Perform Constructor Call

        //  Reserved for passing the execution context
        '__mec',     // MUD Execution Context
        '__ctx',
        '__gec',     // Get context
        '__ifc',    // If context

        //  Reserved for multiple inheritance logic
        '__callScopedImplementation',
        '__callScopedImplementationAsync',
        '__exportScopedProperty'

    ],
    IllegalVariableNames = [
        'MUDObject'
    ],
    ScopeType = Object.freeze({
        CallExpression: 'CallExpression',
        AssignmentExpression: 'AssignmentExpression'
    });


/** @typedef {{ allowJsx: boolean, context: PipeContext, source: string }} OpParams */

/** 
 * @typedef {Object} TranspilerContext 
 * @property {number} callType The call type used in/defined by origin()
 * @property {string} [className] The name of the class currently being defined, if any.
 * @property {string} [functionName] Name of the non-member function being declared/defined
 * @property {boolean} inConstructor Are we defining the constructor method?
 * @property {boolean} isAsync Are we in an async context?
 * @property {boolean} isMemberExpression Is this a member expression?
 * @property {boolean} isSimulEfun Are we parsing the SimulEfun object?  e.g. inherits EFUNProxy
 * @property {boolean} isStatic Are we in a static context?
 * @property {boolean} isSuperExpression
 * @property {boolean} isThisExpression
 * @property {number} jsxDepth How deep in a JSX expression are we?
 * @property {boolean} lazyBinding Is lazy binding enabled?
 * @property {number} mecDepth The suffix to append to the mechName
 * @property {string} mecName The scope-specific name for the execution context
 * @property {string} mecParent The execution context from the parent scope
 * @property {number} memberModifiers What modifiers were applied to the member?
 * @property {string} memberName What method, if any, are we defining?
 * @property {boolean} mustDefineCreate Does the current class need to define a constructor
 * @property {function} pop Pops this context off the stack
 */

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


class MudScriptAstAssembler {
    /**
     * Construct a transpiler op
     * @param {OpParams} p The constructor parameters
     * @param {ExecutionContext} ecc The execution context in which the transpiler is running
     */
    constructor(p, ecc) {
        this.acornOptions = p.acornOptions || false;
        this.allowJsx = p.allowJsx;
        this.allowLazyBindings = p.allowLazyBindings === true;

        this.awaitDepth = 0;
        this.appendText = '';
        this.callerId = [];
        this.canImport = true;
        /** @type {TranspilerContext[]}*/
        this.contextStack = [];
        this.directory = p.directory;
        this.ecc = undefined;
        /** @type {SyntaxError[]} */
        this.errors = [];
        this.errorCount = 0;
        /** @type {ExecutionContext} */
        this.executionContext = ecc;
        this.warningCount = 0;
        this.exportCount = 0;
        this.exports = {};
        this.extension = p.context.extension;
        this.eventCompleteMessages = [];
        this.filename = p.filename;
        this.fullPath = p.context.fullPath;
        this.filepart = p.filename.slice(p.filename.lastIndexOf('/') + 1);
        this.max = p.source.length;
        /** @type {import('../MUDModule')} */
        this.module = p.context.module;
        /** @type {MUDCompilerOptions} */
        this.options = p;
        this.output = '';
        this.pipeline = p.context;
        this.pos = 0;
        this.scopes = [];
        this.source = p.source;
        this.symbols = {};
        this.thisMethod = false;
        this.typeDef = false;
        this.isStatic = false;
        this.injectedSuperClass = p.injectedSuperClass || false;

        this.pushContext({
            callType: 0,
            className: undefined,
            functionName: false,
            inConstructor: false,
            isAsync: false,
            isMemberExpression: false,
            isSimulEfun: false,
            isStatic: false,
            isSuperExpression: false,
            isThisExpression: false,
            jsxDepth: 0,
            lazyBinding: false,
            mecDepth: 0,
            mecName: '__mec',
            mecParent: 'false',
            memberModifiers: MemberModifiers.Public,
            memberName: undefined,
            mustDefineCreate: false,
            pop: () => {
                this.popContext();
            }
        });
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

    addExport(exportName, localName = false) {
        this.exports[exportName] = localName || exportName;
        this.exportCount++;
    }

    get context() {
        return this.contextStack[0];
    }

    eatWhitespace() {
        let startPos = this.pos;

        while (this.pos < this.max && this.source.charAt(this.pos).trim() === '')
            this.pos++;

        return this.pos > startPos ? this.source.slice(startPos, this.pos) : '';
    }

    /**
     * Starts a class definition
     * @param {any} typeName
     * @param {any} modifiers
     * @param {Object} pos
     * @returns
     */
    eventBeginTypeDefinition(typeName, modifiers, pos) {
        pos = this.getPositionFromLocation(pos) || this.getPosition();
        if (this.typeDef !== false) {
            throw new Error(`[Line ${pos.line}, Char ${pos.char}] Nested class definitions are not allowed (currently parsing ${this.typeDef.typeName})`);
        }
        return this.typeDef = this.module.eventBeginTypeDefinition(typeName, modifiers, pos);
    }

    /**
     * End a class definition
     */
    eventEndTypeDefinition() {
        if (this.typeDef !== false) {
            if (!this.typeDef.isAbstract) {
                let typeDef = this.typeDef, undefinedCount = 0;

                for (const [memberName, info] of Object.entries(typeDef.abstractMembers)) {
                    this.raise(`Class '${typeDef.typeName}' must implement abstract member '${memberName}' or be marked abstract; Declared abstract by type '${info.definingType.typeName}' (${info.definingType.filename})`, typeDef.position);
                }
            }
            this.module.eventEndTypeDefinition();
            this.typeDef = false;
        }
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
            let result = (this.output + this.appendText)
                .split('\n')
                .map((line, lineNumber) => line.replaceAll('__line', lineNumber + 1))
                .join('\n');
            return result;
        }
        finally {
            this.output = false;
            this.appendText = false;
        }
    }

    /**
     * Creates a unique filename for a class
     * @param {string} className The name of the class being defined
     * @returns {string} Returns a string representing the module path + class
     */
    getBaseName(className) {
        if (this.filepart === className)
            return this.fullPath;
        else
            return `${this.fullPath}$${className}`;
    }

    getCallerId() {
        return this.callerId.pop();
    }

    getPosition() {
        let before = this.source.slice(0, this.pos),
            lines = before.split(/\r*[\n]{1}/),
            lastLine = lines.pop();

        return { line: lines.length + 1, char: lastLine.length + 1, file: this.filename };
    }

    getPositionFromLocation(loc) {
        if ('loc' in loc) {
            return this.getPositionFromLocation(loc.loc);
        }
        else if ('char' in loc && 'line' in loc) {
            return loc;
        }
        else if (loc && loc.start) {
            return {
                file: this.filename,
                char: loc.start.column + 1,
                line: loc.start.line + 1
            };
        }
        return false;
    }

    importSymbols(symbolMap) {
        for (const [key, val] of Object.entries(symbolMap)) {
            this.symbols[key] = val;
        }
    }

    get method() {
        return this.thisMethod || '(MAIN)';
    }

    popContext() {
        this.contextStack.shift();
    }

    popScope() {
        this.scopes.shift();
    }

    /**
     * Push new context info onto the stack
     * @param {TranspilerContext} ctx New context info
     */
    pushContext(ctx) {
        let
            curContext = this.context || { mecDepth: 0 },
            newContext = Object.assign({}, curContext, ctx);

        if (newContext.mecDepth !== curContext.mecDepth) {
            newContext.mecName = newContext.mecDepth > 0 ? `__mec${newContext.mecDepth}` : '__mec';
            newContext.mecParent = curContext.mecDepth > 0 ? `__mec${curContext.mecDepth}` : '__mec';
        }
        this.contextStack.unshift(newContext);
        return newContext;
    }

    pushScope(scope) {
        this.scopes.unshift(scope);
    }

    /**
     * Raise an exception
     * @param {string} err The error message
     */
    raise(err, pos = false) {
        pos = pos && this.getPositionFromLocation(pos) || this.getPosition();
        this.errors.push(new SyntaxError(`[Line ${pos.line}, Char ${pos.char}]: ${err}`, pos));
        this.errorCount++;
    }

    /**
     * Raise a warning
     * @param {string} err The error message
     */
    warn(msg, pos = false) {
        pos = pos && this.getPositionFromLocation(pos) || this.getPosition();
        this.errors.push(new SyntaxWarning(`[Line ${pos.line}, Char ${pos.char}]: ${msg}`, pos));
        this.warningCount++;
    }

    /**
     * Read from the buffer from current position to specified index.
     * @param {number|string} index The index to read to
     * @param {boolean} peekOnly If true then the position remains unchanged
     * @returns {string} Returns the specified region of the buffer.
     */
    readUntil(index = 0, peekOnly = false) {
        if (typeof index === 'string') {
            let str = index;
            index = this.source.indexOf(str, this.pos);
            if (index < 0) return '';
            index += str.length;
        }
        if (index <= this.pos)
            return '';
        let result = this.source.slice(this.pos, index);
        if (peekOnly !== true) this.pos = index;
        return result;
    }

    /**
     * Replace the node source text with a comment in the output
     * @param {NodeType} e
     */
    replaceWithComment(e) {
        //  Make sure to clean up block comments in the chunk
        let chunk = this.source.slice(e.start, e.end).replace(/\*\/|\/\*/g, '**');
        this.pos = e.end;
        return '/*' + chunk + '*/';
    }

    /**
     * Replace the node source text with whitespace in the output
     * @param {NodeType} e
     */
    replaceWithWhitespace(e) {
        let chunk = this.source.slice(e.start, e.end);
        let bits = [...chunk];

        for (let i = 0; i < bits.length; i++) {
            if (bits[i] !== '\n' && bits[i] !== '\r')
                bits[i] = ' ';

        }
        chunk = bits.join('');
        this.pos = e.end;
        return chunk;
    }

    get scope() {
        return this.scopes.length > 0 && this.scopes[0];
    }

    setMethod(s, access = "public", isStatic = false) {
        this.thisMethod = s || false;
        //this.thisParameter = this.thisClass ? `this || ${this.thisClass}` : 'this';
        this.wroteConstructorName = false;
        return this.thisMethod;
    }

    get thisParameter() {
        return this.typeDef ? `this || ${this.typeDef.typeName}` : 'this';
    }
}

/**
 * 
 * @param {string[]} variableList List of variables to serialize
 * @param {boolean} writable Are these values writable?
 * @returns 
 */
function renderVariableBlock(variableList, writable = true) {
    /*
        a: [ () => a, __xa => a = __xa ]
    */
    let result = [];
    for (const key of variableList) {
        let parts = [];
        parts.push(`() => ${key}`);
        if (writable)
            parts.push(`(__xa) => ${key} = __xa`);
        result.push(`{ ${key}: [${parts.join(', ')}] }`);
    }
    return '[' + result.join(', ') + ']';
}


/**
 * Instruments final source code with runtime assertions designed to protect against runaway code.
 * @param {NodeType} e The node that is being transpiled.
 * @param {string} preText Text inserted before the expression.
 * @param {string} postText Text inserted after the expression.
 * @param {boolean} isCon Is it a constructor?
 * @param {boolean} addIfEmpty Add to an empty block?
 * @param {MudScriptAstAssembler} op
 */
function addRuntimeAssert(e, preText, postText, isCon, addIfEmpty = false, op) {
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
            if (addIfEmpty) {
                let startOfBlock = op.source.slice(op.pos).search('{');

                if (startOfBlock > -1) {
                    e.body.body.unshift({
                        end: op.pos + startOfBlock + 1,
                        type: 'RuntimeAssertion',
                        start: op.pos + startOfBlock + 1,
                        text: preText
                    });
                    if (postText)
                        e.body.body.push({
                            end: op.pos + startOfBlock + 1,
                            type: 'RuntimeAssertion',
                            start: op.pos + startOfBlock + 1,
                            text: postText
                        });
                }
            }
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
 * Simple test to see if the value looks like a string literal
 * @param {any} val
 * @returns
 */
function isLiteralString(val) {
    return typeof val === 'string' &&
        ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'")));
}

/**
 * Parse a single element and return the transpiled source.
 * @param {MudScriptAstAssembler} op The current operation
 * @param {NodeType} e The current node
 * @param {number} depth The stack depth
 * @returns {string} The element as source code.
 */
async function parseElement(op, e, depth) {
    let ret = '';
    if (e) {
        if (e.start > op.pos) {
            ret += op.source.slice(op.pos, e.start);
            op.pos = e.start;
        }
        switch (e.type) {
            case 'ArrayExpression':
                for (const _ of e.elements) {
                    ret += op.readUntil(_.start);
                    ret += await parseElement(op, _, depth + 1);
                }
                break;

            case 'ArrayPattern':
                for (const _ of e.elements) {
                    ret += op.readUntil(_.start);
                    ret += await parseElement(op, _, depth + 1);
                }
                break;

            case 'ArrowFunctionExpression':
                {
                    let ctx = op.pushContext({ isAsync: e.async === true, mecDepth: op.context.mecDepth + 1 });
                    let funcName = e.async ?
                        `async ${op.getCallerId() || '(anonymous)'}(() => {})` :
                        `${op.getCallerId() || '(anonymous)'}(() => {})`,
                        pnames = [];
                    for (const _ of e.params) {
                        ret += await parseElement(op, _, depth + 1);
                        pnames.push(_.name);
                    }

                    ret += op.readUntil(e.body.start);
                    if (e.body.type === 'BlockStatement') {
                        ret += `{ const [${ctx.mecName}, parameters] = __bfc(__ifc(${op.context.mecParent}.branch({ lineNumber: __line }), [${pnames.join(', ')}]) /*7*/, [${pnames.join(', ')}], ${renderVariableBlock(pnames)}, ${op.thisParameter}, 0, '${funcName}', __FILE__, ${e.async}, __line, false, ${CallOrigin.FunctionPointer}); try `;
                        ret += await parseElement(op, e.body, depth + 1);
                        ret += ` finally { __efc(${ctx.mecName}, '${funcName}'); } }`;
                    }
                    else if (e.body.type === 'MemberExpression') {
                        ret += `{ const [${ctx.mecName}, parameters] = __bfc(__ifc(${op.context.mecParent}.branch({ lineNumber: __line }), [${pnames.join(', ')}]) /*8*/, [${pnames.join(', ')}], ${renderVariableBlock(pnames)}, ${op.thisParameter}, 0, '${funcName}', __FILE__, ${e.async}, __line, false, ${CallOrigin.FunctionPointer}); try { return `;
                        ret += await parseElement(op, e.body, depth + 1);
                        ret += `; } finally { __efc(${ctx.mecName}, '${funcName}'); } }`;
                    }
                    else {
                        ret += `{ const [${ctx.mecName}, parameters] = __bfc(__ifc(${op.context.mecParent}.branch({ lineNumber: __line }), [${pnames.join(', ')}]) /*9*/, [${pnames.join(', ')}], ${renderVariableBlock(pnames)}, ${op.thisParameter}, 0, '${funcName}', __FILE__, ${e.async}, __line, false, ${CallOrigin.FunctionPointer}); try { return (`;
                        ret += await parseElement(op, e.body, depth + 1);
                        ret += `); } finally { __efc(${ctx.mecName}, '${funcName}'); } }`;
                    }
                    op.popContext();
                }
                break;

            case 'AssignmentExpression':
                {
                    if (op.allowLazyBindings) {
                        let expr = op.source.slice(e.left.start, e.left.end);
                        if (expr.startsWith('this.')) {
                            op.typeDef && op.typeDef.addPossibleLazyBinding(`set ${expr.slice(5)}`);
                        }
                    }

                    op.pushScope(ScopeType.AssignmentExpression);
                    ret += op.readUntil(e.left.start);
                    ret += await parseElement(op, e.left, depth + 1);
                    ret += op.readUntil(e.right.start);
                    ret += await parseElement(op, e.right, depth + 1);
                    op.popScope();
                }
                break;

            case 'AssignmentPattern':
                ret += await parseElement(op, e.left, depth + 1);
                ret += await parseElement(op, e.right, depth + 1);
                break;

            case 'AwaitExpression':
                {
                    op.awaitDepth++;
                    let tmp = await parseElement(op, e.argument, depth + 1);
                    ret += `await ${op.context.mecName}.awaitResult(async (__ctx) => ${tmp})`;
                    op.awaitDepth--;
                    // Previous working version prior to adding awaitResult():
                    // ret += parseElement(op, e.argument, depth + 1);
                }
                break;

            case 'BinaryExpression':
                if (e.operator === 'instanceof') {
                    ret += 'inherits(';
                    ret += await parseElement(op, e.left, depth + 1);
                    ret += ', ';
                    op.pos = e.right.start;
                    ret += await parseElement(op, e.right, depth + 1);
                    ret += ')';
                }
                else {
                    ret += await parseElement(op, e.left, depth + 1);
                    ret += op.readUntil(e.operator);
                    ret += op.readUntil(e.right.start);
                    ret += await parseElement(op, e.right, depth + 1);
                }
                break;

            case 'BlockStatement':
                {
                    let prevDepth = op.awaitDepth, isMainBlock = false;
                    op.awaitDepth = 0;
                    for (const _ of e.body) {
                        if (op.canImport && _.type !== 'ImportDeclaration') {
                            op.canImport = false;
                            isMainBlock = true;
                        }
                        ret += await parseElement(op, _, depth + 1);
                    }
                    if (isMainBlock) {
                        if (op.exportCount > 0) {
                            let chunks = [], definedDefault = false;
                            ret += 'module.exports = { ';
                            for (const [exportName, localName] of Object.entries(op.exports)) {
                                if (exportName === 'default') {
                                    if (op.defaultExport && op.defaultExport !== localName) {
                                        op.raise(`Type '${op.defaultExport}' has already been exported as the default`);
                                    }
                                    op.defaultExport = localName;
                                    definedDefault = true;
                                }
                                else if (exportName === localName)
                                    chunks.push(exportName);
                                else
                                    chunks.push(`${exportName}: ${localName}`);
                            }
                            ret += chunks.join(', ');
                            ret += ' };'
                            if (op.defaultExport)
                                ret += ` await module.setDefaultExport(${op.context.mecName}.branch({ lineNumber: __line, hint: 'module.setDefaultExport' }), ${op.defaultExport});`;
                        }
                    }
                    op.awaitDepth = prevDepth;
                }
                break;

            case 'BreakStatement':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                break;

            case 'CallExpression':
                op.pushScope(ScopeType.CallExpression);
                {
                    let writeCallee = true,
                        isCallout = false,
                        object = false,
                        propName = false,
                        callee = false,
                        argsWritten = false;

                    if (e.callee.type === 'MemberExpression') {
                        let orgObject = op.source.slice(e.callee.object.start, e.callee.object.end);

                        object = await parseElement(op, e.callee.object, depth + 1);

                        let ctx = op.pushContext({
                            isSuperExpression: object === 'super',
                            isThisExpression: object === 'this'
                        });

                        if (object in op.symbols) {
                            // do not double-expand symbols
                        }
                        else if (ctx.isSuperExpression && e.callee.property.type === 'ScopedIdentifier') {
                            op.warn(`Scoped identifiers should be accessed using 'this' instead of 'super'; Example: this${(e.callee.usingDerefArrow ? '->' : '.')}${op.source.slice(e.callee.property.start, e.callee.property.end)}`, e.callee);
                            //  We like using 'super' but in reality we want 'this' to ensure ALL inherited scopes are visible
                            object = 'this';
                            //  both isThisExpression AND isSuperExpression are now true
                            ctx.isThisExpression = true;
                        }
                        if (e.callee.usingDerefArrow) {
                            op.pos += 2;
                            let propNameActual = await parseElement(op, e.callee.property, depth + 1);
                            propName = '.' + propNameActual;

                            if (!ctx.isSuperExpression && !ctx.isThisExpression) {
                                if (op.context.isAsync)
                                    object = `(await unwrapAsync(${op.context.mecName}, ` + object + '))';
                                else {
                                    if (isLiteralString(object)) {
                                        if (op.context.memberName)
                                            op.warn(`Using identifier '${orgObject}' for call in non-async context may result in an object not found error at runtime`, e.callee);
                                    }
                                    object = `unwrap(${op.context.mecName}, ` + object + ')';
                                }
                            }
                        }
                        else
                            propName = await parseElement(op, e.callee.property, depth + 1);

                        let propNameActual = propName.charAt(0) === '.' ? propName.slice(1) : propName,
                            definers = op.typeDef && op.typeDef.getInheritedMember(propNameActual);

                        propName += op.readUntil(e.callee.end);
                        if (propNameActual === 'call' || propNameActual === 'apply') {
                            if (e.arguments.length === 0 || e.arguments[0].type !== 'ThisExpression') {
                                op.raise('For security reasons, the first argument to call or apply MUST be this', e.callee.property);
                            }
                        }
                        else if (propNameActual === MemberModifiers.ConstructorName) {
                            if (!ctx.inConstructor)
                                op.raise(`Constructor method '${MemberModifiers.ConstructorName}' may not be called here`);
                            if (!ctx.isThisExpression) {
                                if (ctx.isSuperExpression)
                                    op.warn(`Constructor method '${MemberModifiers.ConstructorName}' should be called using 'this' keyword (not super)`, e.callee);
                                else
                                    op.raise(`Constructor method '${MemberModifiers.ConstructorName}' may only be called using 'this' keyword`, e.callee);
                            }
                        }
                        if (definers && definers.length > 1) {
                            let baseError = `Call to member '${propNameActual}' is ambigious; Could be `,
                                callOperator = e.callee.usingDerefArrow ? '->' : '.',
                                parts = definers.implementors.map(pc => `this${callOperator}${pc.typeName}::${propNameActual}`);

                            op.raise(baseError + parts.slice(0, -1).join(', ') + ' or ' + parts.slice(-1));
                        }
                        op.addCallerId(propName.slice(1));
                        if (propName.startsWith('[')) {
                            propName = '[__asi(' + propName.slice(1, propName.length - 1) + ', __FILE__, __line)]';
                        }
                        callee = object + propName;

                        if (e.callee.property.type === 'ScopedIdentifier') {
                            writeCallee = false;
                            argsWritten = true;
                            ret += callee;
                            if (e.arguments.length) {
                                ret += ', '
                                op.pos = e.arguments[0].start;
                                for (const _ of e.arguments) {
                                    ret += op.readUntil(_.start);
                                    ret += await parseElement(op, _, depth + 1);
                                }
                            }
                            ret += ')';
                            op.pos = e.end;
                        }
                    }
                    else if (e.callee.type === 'Identifier') {
                        propName = callee = await parseElement(op, e.callee, depth + 1);
                        if (SettersGetters.indexOf(propName) > -1) {
                            let parts = (op.thisMethod || '').split(/\s+/),
                                prop = parts.pop();

                            if (!op.typeDef)
                                op.raise(`The ${propName} operator can only be used inside a class.`);

                            else if (parts.indexOf('get') === -1 && parts.indexOf('set') === -1)
                                op.raise(`The ${propName} operator cannot be used within non getter/setter '${op.thismethod || op.method || 'unknown'}'`, e.callee);

                            // set.call(this, ... args)
                            ret += propName;
                            //  TODO: Change type parameter to filename string
                            ret += `.call(this, ${op.context.mecName}, ${op.typeDef.typeName}, '${prop}'`
                            if (e.arguments.length > 0) {
                                ret += ', ';
                                op.readUntil(e.arguments[0].start);
                                for (const _ of e.arguments) {
                                    ret += await parseElement(op, _, depth + 1)
                                }
                            }
                            op.readUntil(e.end);
                            ret += ')';
                            isCallout = true;
                            writeCallee = false;
                        }
                        else if (propName === 'createAsync') {
                            ret += callee;
                            ret += `('${op.fullPath}'`;
                            if (e.arguments.length) {
                                ret += ', ';
                                let foobar = op.readUntil('(');
                            }
                            writeCallee = false;
                        }
                        else
                            op.addCallerId(propName);
                    }
                    else if (e.callee.type === 'Super') {
                        propName = callee = await parseElement(op, e.callee, depth + 1);
                        op.addCallerId(propName);
                    }
                    else if (e.callee.type === 'FunctionExpression') {
                        propName = callee = await parseElement(op, e.callee, depth + 1);
                        op.addCallerId('function()');
                    }
                    else if (e.callee.type === 'ArrowFunctionExpression') {
                        propName = callee = await parseElement(op, e.callee, depth + 1);
                        op.addCallerId('() => {}');
                    }
                    else if (e.callee.type === 'CallExpression') {
                        ret += await parseElement(op, e.callee.callee, depth + 1);
                        for (const _ of e.callee.arguments) {
                            ret += await parseElement(op, _, depth + 1)
                        }
                        writeCallee = false;
                        ret += '';
                    }
                    else {
                        op.raise(`Unexpected callee type ${e.callee.type}`, e.callee);
                    }

                    if (writeCallee)
                        ret += callee;
                    if (!isCallout && !argsWritten) {
                        if (e.callee.type !== 'ArrowFunctionExpression') {
                            let c = 0, hint;

                            switch (e.callee.type) {
                                case 'CallExpression':
                                    try {
                                        hint = op.source.slice(e.callee.arguments[0].start, e.callee.arguments[0].body.start);
                                    }
                                    catch (e) {
                                        console.log(e);
                                    }
                                    break;
                                case 'Identifier':
                                    hint = e.callee.name;
                                    break;
                                case 'MemberExpression':
                                    hint = e.callee.property.name;
                                    break;
                                default:
                                    hint = calee;
                                    break;
                            }

                            for (const _ of e.arguments) {
                                ret += op.readUntil(_.start);
                                if (c++ === 0) {
                                    ret += op.context.mecName + `.branch({ lineNumber: __line, hint: '${hint}' }), `;
                                }
                                ret += await parseElement(op, _, depth + 1);
                            }
                            if (c === 0) {
                                if (op.context.mecDepth > 0) {
                                    if (op.source.charAt(e.arguments.start) === '(') {
                                        ret += op.readUntil(e.arguments.start + 1);
                                        ret += op.context.mecName + `.branch({ lineNumber: __line, hint: '${hint}' })`;
                                    }
                                }
                            }
                        }
                    }
                    ret += op.readUntil(e.end);
                    //if (!ret.startsWith('await')) {
                    //    let nowrap = false;

                    //    if (callee === 'super' && !ret.contains('.'))
                    //        nowrap = true;
                    //    else if (!ret.startsWith(callee))
                    //        nowrap = true;

                    //    // Ensure unawaited function calls are not calling async
                    //    // Only wrap calls if we feel certain not to screw up
                    //    if (false === nowrap) {
                    //        if (!ret.contains('await') && op.awaitDepth === 0)
                    //            ret = `__mec.validSyncCall(__FILE__, __line, () => ${ret})`;
                    //    }
                    //}
                    if (e.callee.type === 'MemberExpression')
                        op.popContext();
                }
                op.popScope();
                break;

            case 'CatchClause':
                ret += await parseElement(op, e.param, depth + 1);
                addRuntimeAssert(e, `__cat(${op.context.mecName}, ${e.param.name}); `);
                ret += await parseElement(op, e.body, depth + 1);
                break;

            case 'ClassBody':
                for (const _ of e.body) {
                    ret += await parseElement(op, _, depth + 1)
                }
                op.forcedInheritance = false;
                break;

            case 'ClassDeclaration':
                {
                    let parentClassList = [];

                    if (e.modifier) {
                        //  Do not include raw modifiers in output
                        if (e.modifier.raw.length > 0) ret += `/*${e.modifier.raw}*/`;
                        op.pos = Math.max(op.pos, e.modifier.end);
                    }
                    let typeDef = op.eventBeginTypeDefinition(e.id.name, e.classModifiers || 0, e.loc);

                    ret += await parseElement(op, e.id, depth + 1);

                    if (e.superClass) {
                        ret += op.readUntil(e.superClass.start);
                        ret += await parseElement(op, e.superClass, depth + 1);
                        op.pushContext({ className: e.id.name, isSimulEfun: e.superClass.name === 'EFUNProxy' });
                    }
                    else if (op.injectedSuperClass) {
                        op.forcedInheritance = true;
                        ret += ` extends ${op.injectedSuperClass} `;
                        e.parentClasses.push({ name: op.injectedSuperClass });
                        op.pushContext({ className: e.id.name, mustDefineCreate: e.parentClasses.length > 1 });
                    }
                    if (Array.isArray(e.parentClasses)) {
                        parentClassList = e.parentClasses.map(pc => pc.name);
                        for (const classId of parentClassList) {
                            let classRef = op.symbols[classId] || false;

                            if (!classRef) {
                                if (classId === 'MUDObject' || classId === 'EFUNProxy' || classId === 'SimpleObject') continue;
                                op.raise(`Could not inherit unresolved class: '${classId}'`);
                            }
                            else if (!driver.efuns.isClass(op.executionContext, classRef)) {
                                if (driver.efuns.inherits(op.executionContext, classRef, 'MUDObject')) {
                                    classRef = classRef.constructor;
                                }
                                else {
                                    op.raise(`Class '${typeDef.typeName}' cannot extend '${classId}' since it is not a MUDObject (type: ${typeof classRef})`, e.loc);
                                }
                            }
                            if (classRef) {
                                let flags = classRef.prototype.typeModifiers;
                                if ((flags & MemberModifiers.Final) > 0) {
                                    op.raise(`Class '${typeDef.typeName}' cannot extend '${classId}' since it is declared final`, e.loc);
                                }
                                typeDef.importTypeInfo(op.executionContext, classRef, classId);
                            }
                        }
                    }
                    //  Skip passed any additional extend statements
                    op.pos = e.body.start;

                    ret += await parseElement(op, e.body, depth + 1);
                    ret += ` ${e.id.name}.prototype.baseName = '${op.getBaseName(e.id.name)}'; `;
                    ret += ` ${e.id.name}.prototype.typeModifiers = ${(e.classModifiers || 0)}; `;
                    if (op.allowLazyBindings && op.typeDef.lazyBindingCount > 0) {
                        for (const entry of Object.keys(op.typeDef.possibleLazyBindings)) {
                            //  TODO: Make sure this is not a getter-only property
                            let propName = entry.slice(4),
                                getterOnly = op.typeDef.getMember(`get ${propName}`),
                                setterOnly = op.typeDef.getMember(`set ${propName}`),
                                getter = ` const [__mec, parameters] = __bfc(false, arguments, {}, this || ${e.id.name}, ${op.options.defaultMemberAccess}, 'get ${propName}', __FILE__, false, __line, ${e.id.name}, ${CallOrigin.GetProperty}); try { return __mec.validSyncCall(__FILE__, __line, () => get.call(this, ${e.id.name}, '${propName}', undefined)); } finally { __efc(__mec, 'get ${propName}'); }`,
                                setter = ` const [__mec, parameters] = __bfc(false, arguments, { val }, this || ${e.id.name}, ${op.options.defaultMemberAccess}, 'set ${propName}', __FILE__, false, __line, ${e.id.name}, ${CallOrigin.SetProperty}); try { __mec.validSyncCall(__FILE__, __line, () => set.call(this, ${e.id.name}, '${propName}', val)); } finally { __efc(__mec, 'set ${propName}'); }`,
                                injectedSource = ` Object.defineProperty(${e.id.name}.prototype, '${propName}', { configurable: false, enumerable: true, get: function() { ${getter}}, set: function(val) { ${setter} } }); `;

                            if (getterOnly) {
                                op.raise(`Class '${typeDef.typeName}' cannot automatically define 'set ${propName}' for read-only property`);
                            }
                            else if (setterOnly) {
                                op.raise(`Class '${typeDef.typeName}' cannot automatically define 'set ${propName}' for write-only property`);
                            }
                            ret += injectedSource;
                        }
                    }
                    ret += `extendType(__mec1, ${typeDef.typeName}, ${parentClassList.join(',')});`;
                    ret += `__dmt(__mec1, "${op.fullPath}", ${e.id.name}); `;
                    if (op.context.mustDefineCreate) {
                        if (!typeDef.isMember('create')) {
                            op.raise(`Class '${typeDef.typeName}' inherits ${parentClassList.length} types and requires a 'create' constructor`, e.loc)
                        }
                    }
                    op.eventEndTypeDefinition();
                    op.popContext();
                }
                break;

            case 'ConditionalExpression':
                ret += op.readUntil(e.test.start);
                ret += await parseElement(op, e.test, depth + 1);
                ret += op.readUntil(e.consequent.start);
                ret += await parseElement(op, e.consequent, depth + 1);
                ret += op.readUntil(e.alternate.start);
                ret += await parseElement(op, e.alternate, depth + 1);
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

            case 'DereferencedCallExpression':
                op.pos = e.end;
                break;

            case 'DoWhileStatement':
                addRuntimeAssert(e, '__ala(); ', undefined, undefined, true, op);
                if (e.body.type !== 'BlockStatement') {
                    op.raise('Do-while loop body must be a block statement');
                }
                ret += await parseElement(op, e.body, depth + 1);
                ret += await parseElement(op, e.test, depth + 1);
                break;

            case 'EmptyStatement':
                ret += op.source.slice(op.pos, e.end);
                break;

            case 'ExportDefaultDeclaration':
                op.pos = e.declaration.start;
                if (e.declaration.type !== 'ClassDeclaration')
                    op.raise(`MUDScript default export may only be a class and not ${e.declaration.type}`, e.declaration);
                else if (op.defaultExport)
                    op.raise(`Type '${op.defaultExport}' has already been exported as the default`, e.declaration);
                else {
                    ret += await parseElement(op, e.declaration, depth + 1);
                    op.defaultExport = e.declaration.id.name;
                    op.exportCount++;
                }
                break;

            case 'ExportNamedDeclaration':
                {
                    if (e.declaration) {
                        op.pos = e.declaration.start;

                        switch (e.declaration.type) {
                            case 'ClassDeclaration':
                                {
                                    op.addExport(e.declaration.id.name);
                                    ret += await parseElement(op, e.declaration, depth + 1);
                                }
                                break;

                            case 'FunctionDeclaration':
                                {
                                    op.addExport(e.declaration.id.name);
                                    ret += await parseElement(op, e.declaration, depth + 1);
                                }
                                break;

                            case 'VariableDeclaration':
                                {
                                    for (const decl of e.declaration.declarations) {
                                        if (decl.type === 'VariableDeclarator') {
                                            if (decl.id.type === 'Identifier') {
                                                op.addExport(decl.id.name);
                                            }
                                            else if (decl.id.type === 'ObjectPattern') {
                                                for (const propValue of decl.id.properties.map(p => p.value)) {
                                                    if (propValue.type === 'Identifier') {
                                                        op.addExport(propValue.name);
                                                    }
                                                    else
                                                        op.raise(`Unhandled property type '${propValue.type}' in export object pattern`, decl);
                                                }
                                            }
                                            else if (decl.id.type === 'ArrayPattern') {
                                                for (const propValue of decl.id.elements) {
                                                    if (propValue.type === 'Identifier')
                                                        op.addExport(propValue.name);
                                                    else
                                                        op.raise(`Unhandled element type '${propValue.type}' in export array pattern`, propValue);
                                                }
                                            }
                                            else {
                                                op.raise(`Unhandled declaration type in export: ${decl.type}`, decl);
                                            }
                                            ret += await parseElement(op, decl, depth + 1);
                                        }
                                    }
                                }
                                break;
                        }
                    }
                    else if (Array.isArray(e.specifiers)) {
                        for (const spec of e.specifiers) {
                            if (spec.exported.type !== 'Identifier')
                                op.raise('Exported name must be an Identifier', spec.exported);
                            if (spec.local.type !== 'Identifier')
                                op.raise('Local name must be an Identifier', spec.local);
                            op.addExport(spec.exported.name, spec.local.name);
                        }
                        ret += op.replaceWithComment(e);
                    }
                }
                break;

            case 'ExpressionStatement':
                ret += await parseElement(op, e.expression, depth + 1);
                break;

            case 'ForInStatement':
                ret += await parseElement(op, e.left, depth + 1);
                ret += await parseElement(op, e.right, depth + 1);
                addRuntimeAssert(e, '__ala(); ', undefined, undefined, true, op);
                if (e.body.type !== 'BlockStatement') {
                    op.raise('For loop body must be a block statement');
                }
                ret += await parseElement(op, e.body, depth + 1);
                break;

            case 'ForOfStatement':
                ret += await parseElement(op, e.left, depth + 1);
                ret += await parseElement(op, e.right, depth + 1);
                addRuntimeAssert(e, '__ala(); ', undefined, undefined, true, op);
                if (e.body.type !== 'BlockStatement') {
                    op.raise('For loop body must be a block statement');
                }
                ret += await parseElement(op, e.body, depth + 1);
                break;

            case 'ForStatement':
                ret += await parseElement(op, e.init, depth + 1);
                ret += await parseElement(op, e.test, depth + 1);
                ret += await parseElement(op, e.update, depth + 1);
                if (e.body.type !== 'BlockStatement') {
                    op.raise('For loop body must be a block statement');
                }
                addRuntimeAssert(e, '__ala(); ', undefined, undefined, true, op);
                ret += await parseElement(op, e.body, depth + 1);
                break;

            case 'FunctionDeclaration':
                {
                    let functionName = e.id.name,
                        ctx = op.pushContext({
                            isAsync: e.async === true,
                            memberName: false,
                            memberModifiers: MemberModifiers.Public,
                            mecDepth: op.context.mecDepth + 1
                        });
                    if (IllegalIdentifiers.indexOf(functionName) > -1)
                        op.raise(`Illegal function name: ${functionName}`, e.id);
                    else if (functionName.startsWith('__mec'))
                        op.raise(`Illegal function name: ${functionName}`, e.id);
                    else if (SettersGetters.indexOf(functionName) > -1)
                        op.raise(`Illegal function name: ${functionName}`, e.id);
                    ret += await parseElement(op, e.id, depth + 1);

                    let pnames = [];
                    for (const _ of e.params) {
                        ret += await parseElement(op, _, depth + 1);
                        pnames.push(_.name);
                    }
                    if (op.typeDef) {
                        addRuntimeAssert(e,
                            `const [${ctx.mecName}, parameters] = __bfc(__ctx /*10*/, arguments, ${renderVariableBlock(pnames)}, ${op.thisParameter}, ${MemberModifiers.Public}, '${e.id.name}', __FILE__, ${ctx.isAsync}, __line); try { `,
                            ` } finally { __efc(${ctx.mecName}, '${e.id.name}'); }`);
                    }
                    else
                        addRuntimeAssert(e,
                            `const [${ctx.mecName}, parameters] = __bfc(__ctx /*11*/, arguments, ${renderVariableBlock(pnames)}, this, ${MemberModifiers.Public}, '${e.id.name}', __FILE__,  ${ctx.isAsync}, __line); try { `,
                            ` } finally { __efc(${ctx.mecName}, '${e.id.name}'); }`);
                    ret += op.readUntil(e.body.start);
                    let n = ret.lastIndexOf('(');
                    if (n > -1) {
                        if (e.params.length)
                            ret = ret.slice(0, n + 1) + '__ctx, ' + ret.slice(n + 1);
                        else
                            ret = ret.slice(0, n + 1) + '__ctx' + ret.slice(n + 1);
                    }
                    ret += await parseElement(op, e.body, depth + 1, { name: functionName });
                    ctx.pop();
                }
                break;

            case 'FunctionExpression':
                {
                    let ctx = op.pushContext({ isAsync: e.async === true, mecDepth: op.context.mecDepth + 1 }), pnames = [];
                    ret += await parseElement(op, e.id, depth + 1);
                    for (const _ of e.params) {
                        ret += await parseElement(op, _, depth + 1);
                        if (_.name)
                            pnames.push(_.name);
                        else if (_.type === 'AssignmentPattern' && _.left.name)
                            pnames.push(_.left.name);
                        else if (_.type === 'RestElement' && _.argument.name)
                            pnames.push(_.argument.name);
                        else
                            throw new Error('Could not determine parameter name');
                    }
                    ret += op.readUntil(e.body.start);
                    if (ctx.callType !== CallOrigin.GetProperty && ctx.callType !== CallOrigin.SetProperty) {
                        let n = ret.indexOf('(');
                        if (n > -1) {
                            if (e.params.length)
                                ret = ret.slice(0, n + 1) + '__ctx, ' + ret.slice(n + 1);
                            else
                                ret = ret.slice(0, n + 1) + '__ctx' + ret.slice(n + 1);
                        }
                        if (op.typeDef && op.thisMethod) {
                            if (ctx.callType === CallOrigin.Constructor && op.typeDef) {
                                addRuntimeAssert(e,
                                    (op.forcedInheritance && op.wroteConstructorName === false ? `super.${ctx.memberName}();` : '') +
                                    `const [${ctx.mecName}, parameters] = __bfc(__ctx /*1*/, arguments, ${renderVariableBlock(pnames)}, ${op.thisParameter}, ${op.context.memberModifiers}, '${op.context.memberName}', __FILE__, false, __line, ${op.context.className}, ${CallOrigin.Constructor}); try { `,
                                    ` } finally { __efc(${ctx.mecName}, '${op.method}'); }`, true);
                                op.wroteConstructorName = true;
                            }
                            else if (op.context.memberName) {
                                addRuntimeAssert(e,
                                    `const [${ctx.mecName}, parameters] = __bfc(__ctx /*2*/, arguments, ${renderVariableBlock(pnames)}, ${op.thisParameter}, ${op.context.memberModifiers}, '${op.context.memberName}', __FILE__, false, __line, ${op.context.className}, ${op.context.callType}); try { `,
                                    ` } finally { __efc(${ctx.mecName}, '${op.method}'); }`, false, true, op);
                            }
                            else {
                                addRuntimeAssert(e,
                                    `const [${ctx.mecName}, parameters] = __bfc(__ifc(${op.context.mecParent}, [${pnames.join(', ')}]) /*3*/, arguments, ${renderVariableBlock(pnames)}, ${op.thisParameter}, 1 /* public */, '(anonymous)', __FILE__, false, __line, undefined, ${op.context.callType}); try { `,
                                    ` } finally { __efc(${ctx.mecName}, '(anonymous)'); }`, false);
                            }
                        }
                        else if (op.context.functionName) {
                            addRuntimeAssert(e,
                                `const [${ctx.mecName}, parameters] = __bfc(${ctx.mecParent} /*4*/, arguments, ${renderVariableBlock(pnames)}, ${op.thisParameter}, ${op.context.memberModifiers}, '${op.context.functionName}', __FILE__, false, __line, false, ${op.context.callType}); try { `,
                                ` } finally { __efc(${ctx.mecName}, '${op.method}'); }`, false);
                        }
                        else {
                            addRuntimeAssert(e,
                                `const [${ctx.mecName}, parameters] = __bfc(__ifc(${op.context.mecParent}, [${pnames.join(', ')}]) /*5*/, arguments, ${renderVariableBlock(pnames)}, ${op.thisParameter}, ${op.context.memberModifiers}, '${(op.context.functionName || op.context.memberName)}', __FILE__, false, __line, false, ${op.context.callType}); try { `,
                                ` } finally { __efc(${ctx.mecName}, '${op.method}'); }`, false);
                        }
                    }
                    else {
                        addRuntimeAssert(e,
                            `const [${ctx.mecName}, parameters] = __bfc(__gec/*6*/, arguments, ${renderVariableBlock(pnames)}, ${op.thisParameter}, ${op.context.memberModifiers}, '${(op.context.functionName || op.context.memberName)}', __FILE__, false, __line, false, ${op.context.callType}); try { `,
                            ` } finally { __efc(${ctx.mecName}, '${op.method}'); }`, false);
                    }
                    ret += op.readUntil(e.body.start);
                    let innerCtx = op.pushContext({ memberName: undefined, className: undefined, callType: 0, memberModifiers: 1 });
                    ret += await parseElement(op, e.body, depth + 1);
                    innerCtx.pop();
                    ctx.pop();
                }
                break;

            case 'Identifier':
                let identifier = op.source.slice(e.start, e.end);

                if (IllegalIdentifiers.indexOf(identifier) > -1 && !op.context.isMemberExpression) {
                    op.raise(`Illegal identifier: ${identifier}`, e);
                }
                else if (identifier.startsWith('__mec')) {
                    op.raise(`Illegal identifier: ${identifier}`, e);
                }
                else if (identifier in op.symbols && identifier in op.symbols.__proto__ === false) {
                    let symbolValue = op.symbols[identifier];
                    if (typeof symbolValue === 'string') {
                        ret += `'${op.symbols[identifier]}'`;
                    }
                    else if (driver.efuns.isClass(op.executionContext, symbolValue)) {
                        ret += identifier;
                    }
                    else if (typeof symbolValue === 'function') {
                        ret += symbolValue.toString();
                    }
                    else if (efuns.isPOO(op.executionContext, symbolValue)) {
                        ret += JSON.stringify(symbolValue);
                    }
                    else if (Array.isArray(symbolValue)) {
                        ret += identifier;
                    }
                    else if (typeof symbolValue === 'object') {
                        ret += identifier;
                    }
                    else {
                        ret += identifier;
                    }
                }
                else
                    ret += identifier;
                op.pos = e.end;
                break;

            case 'IfStatement':
                ret += op.readUntil(e.test.start);
                ret += await parseElement(op, e.test, depth + 1);
                ret += await parseElement(op, e.consequent, depth + 1);
                if (e.alternate) {
                    ret += op.readUntil(e.alternate.start);
                    ret += await parseElement(op, e.alternate, depth + 1);
                }
                break;

            case 'ImportDeclaration':
                if (!op.canImport)
                    op.raise(`Import statement cannot appear here; Imports must all appear at top of module`, e);
                else {
                    let specifiers = {},
                        locals = [],
                        isIdentifier = e.source.type === 'Identifier',
                        source = op.source.slice(e.source.start, e.source.end);

                    if (isIdentifier) {
                        if (source in op.symbols)
                            source = `'${op.symbols[source]}'`;
                        else
                            e.raise(`Import encountered unknown identifier '${source}'`, source);;
                    }

                    for (const spec of e.specifiers) {
                        switch (spec.type) {
                            case 'ImportSpecifier':
                                {
                                    let local = spec.local.name,
                                        imported = spec.imported.name;
                                    locals.push(local);
                                    specifiers[local] = imported;
                                }
                                break;

                            case 'ImportDefaultSpecifier':
                                {
                                    let local = spec.local.name;
                                    locals.push(local);
                                    specifiers[local] = 'default';
                                }
                                break;

                            case 'ImportNamespaceSpecifier':
                                {
                                    let local = spec.local.name;
                                    locals.push(local);
                                    specifiers[local] = 'exports';
                                }
                                break;

                            default:
                                op.raise(`Unhandled import specifier: ${spec.type}`);
                        }
                    }
                    ret += `const { ${locals.join(', ')} } = await efuns.importAsync(${op.context.mecName}.branch({ hint: 'importAsync', lineNumber: __line }), ${source}, ${JSON.stringify(specifiers)}, false, __line);`;
                    op.importSymbols(await efuns.importAsync(op.executionContext, source.replace(/^[\'\"]{1}|[\'\"]{1}$/g, ''), specifiers, op.directory));
                    op.pos = e.end;
                }
                break;

            case 'JSXAttribute':
                if (!op.options.allowJsx)
                    op.raise(`JSX is not enabled for ${op.extension} files`, e);
                op.pos = e.end;
                ret += await parseElement(op, e.name, depth + 1);
                ret += ':';
                op.pos = e.value.start;
                ret += await parseElement(op, e.value, depth + 1);
                break;

            case 'JSXClosingElement':
                if (!op.options.allowJsx)
                    op.raise(`JSX is not enabled for ${op.extension} files`, e);
                ret += ')';
                op.pos = e.end;
                break;

            case 'JSXElement':
                if (!op.options.allowJsx)
                    op.raise(`JSX is not enabled for ${op.extension} files`, e);
                ret += `createElement(${op.context.mecName}, `;
                op.pos = e.start;
                ret += await parseElement(op, e.openingElement, depth + 1);
                if (e.children.length > 0) {
                    for (const [i, _] of e.children.entries()) {
                        if (i === 1) op.context.jsxDepth++;
                        let t = await parseElement(op, _, depth + 1);
                        if (t.length) {
                            ret += ', ' + (_.type === 'JSXElement' ? '' : '') + t;
                        }
                    }
                }
                op.pos = e.end;
                ret += e.closingElement ? await parseElement(op, e.closingElement, depth + 1) : ')';
                op.context.jsxDepth--;
                break;

            case 'JSXIdentifier':
                if (!op.allowJsx)
                    op.raise(`JSX is not enabled for ${this.extension} files`, e);
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
                    op.raise(`JSX is not enabled for ${this.extension} files`, e);
                op.pos = e.expression.start;
                ret += await parseElement(op, e.expression, depth + 1);
                op.pos = e.end;
                break;

            case 'JSXOpeningElement':
                if (!op.allowJsx)
                    op.raise(`JSX is not enabled for ${this.extension} files`, e);
                op.pos = e.end;
                ret += await parseElement(op, e.name, depth + 1);
                ret += ', {';
                for (const [i, _] of e.attributes.entries()) {
                    ret += (i > 0 ? ', ' : '');
                    ret += await parseElement(op, _, depth + 1);
                }
                ret += '}';
                op.pos = e.end;
                break;

            case 'JSXText':
                if (!op.allowJsx)
                    op.raise(`JSX is not enabled for ${this.extension} files`, e);
                ret += e.value.trim().length === 0 ? ret : `"${e.raw.replace(/([\r\n]+)/g, "\\$1")}"`;
                op.pos = e.end;
                break;

            case 'Literal':
                let literal = op.source.slice(e.start, e.end);
                ret += literal;
                op.pos = e.end;
                break;

            case 'LogicalExpression':
                ret += op.readUntil(e.left.start);
                ret += await parseElement(op, e.left, depth + 1);
                ret += op.readUntil(e.right.start);
                ret += await parseElement(op, e.right, depth + 1);
                break;

            case 'MemberExpression':
                {
                    let ctx = op.pushContext({ isMemberExpression: true });
                    ret += op.readUntil(e.object.start);
                    ret += await parseElement(op, e.object, depth + 1);
                    if (e.usingDerefArrow) {
                        op.pos += 2;
                        ret += '.';
                    }
                    ret += op.readUntil(e.property.start);
                    ret += await parseElement(op, e.property, depth + 1);
                    ctx.pop();
                }
                break;

            case 'MethodDefinition':
                {
                    if (e.access) {
                        op.pos = e.access.end;
                        op.eatWhitespace();
                    }
                    if (e.modifier) {
                        //  Comment out keywords that are not proper JavaScript
                        ret += e.modifier.keywords
                            .map(kw => {
                                if (kw === 'static' || kw === 'async')
                                    return kw;
                                else
                                    return `/*${kw}*/`
                            })
                            .join(' ');
                        op.pos = e.modifier.end;
                    }
                    ret += op.eatWhitespace();
                    let methodName = op.setMethod(await parseElement(op, e.key, depth + 1), e.accessKind, e.static),
                        modifiers = e.methodModifiers || 0,
                        parentInfo = op.typeDef.getInheritedMember(methodName);

                    if ((modifiers & MemberModifiers.ValidAccess) === 0) {
                        if (op.options.requireExplicitAccessModifiers)
                            op.raise(`Member '${methodName}' in class ${op.context.className} requires valid access modifier (public, protected, private, or package)`);
                        else if (op.options.defaultMemberAccess)
                            modifiers |= op.options.defaultMemberAccess;
                    }

                    let ctx = op.pushContext({
                        callType: (function (kind) {
                            switch (kind) {
                                case 'constructor': return CallOrigin.Constructor;
                                case 'get': return CallOrigin.GetProperty;
                                case 'set': return CallOrigin.SetProperty;
                                case 'method': return op.context.isSimulEfun ? CallOrigin.SimulEfun : CallOrigin.LocalCall;
                                default: return 0;
                            }
                        })(e.kind),
                        inConstructor: methodName === MemberModifiers.ConstructorName,
                        isAsync: (modifiers & MemberModifiers.Async) > 0,
                        isStatic: e.static || (modifiers & MemberModifiers.Static) > 0,
                        memberName: methodName,
                        memberModifiers: modifiers
                    });

                    if (parentInfo) {
                        if ((parentInfo.modifiers & MemberModifiers.Final) > 0) {
                            let baseMessage = `Class member '${methodName}' in type '${op.typeDef.typeName}' cannot be defined; Marked final by `;
                            let definers = parentInfo.getFinalDefiners();
                            let addedParts = [];

                            for (let i = 0, lastIndex = definers.length - 1; i < definers.length; i++) {
                                let definer = definers[i];
                                if (i > 0) {
                                    if (i === lastIndex)
                                        addedParts.push(' and ');
                                    else
                                        addedParts.push(', ');
                                }
                                addedParts.push(`type '${definer.typeName}' (${definer.filename})`, e);
                            }

                            op.raise(baseMessage + addedParts.join(''));
                        }
                        else if ((modifiers & MemberModifiers.Override) === 0) {
                            let baseMessage = `Class member '${methodName}' in type '${op.typeDef.typeName}' masks previous implementation and must be marked as override; Defined in `;
                            let definers = parentInfo.implementors;
                            let addedParts = [];

                            for (let i = 0, lastIndex = definers.length - 1; i < definers.length; i++) {
                                let definer = definers[i];
                                if (i > 0) {
                                    if (i === lastIndex)
                                        addedParts.push(' and ');
                                    else
                                        addedParts.push(', ');
                                }
                                addedParts.push(`type '${definer.typeName}' (${definer.filename})`);
                            }

                            op.raise(baseMessage + addedParts.join(''), e);
                        }
                    }

                    let memberOrError = op.typeDef.addMember(methodName, modifiers);

                    if (typeof memberOrError === 'string')
                        op.raise(memberOrError, e);

                    if (methodName === 'constructor' && op.options.allowConstructorKeyword === false) {
                        op.raise(`Game objects may not define JavaScript constructors`, e);
                    }
                    let info = {
                        callType: 0,
                        methodName
                    };
                    ret += methodName;
                    //  Special case for empty method definitions
                    if (e.value?.body?.body?.length === 0) {
                        //e.value.body.body.push({ type: 'Identifier', name: '', start: e.value.start, end: e.value.start });
                    }
                    ret += await parseElement(op, e.value, depth + 1, info);
                    op.setMethod();
                    ctx.pop();
                }
                break;

            case 'NewExpression':
                {
                    let callee = op.source.slice(e.callee.start, e.callee.end),
                        hasArgs = e.arguments.length > 0;
                    op.pos = e.callee.end;
                    ret += `__pcc(${op.context.mecName}, ${op.thisParameter}, ${callee}, __FILE__, '${op.method}', ct => new ct`;
                    if (hasArgs) {
                        ret += op.readUntil(e.arguments[0].start);
                        ret += op.context.mecName + ', ';
                        for (const _ of e.arguments) {
                            ret += await parseElement(op, _, depth + 1);
                        }
                    }
                    if (op.pos !== e.end) {
                        if (op.pos > e.end) throw new Error('Oops?');
                        ret += op.source.slice(op.pos, e.end);
                        op.pos = e.end;
                    }
                    if (!hasArgs) {
                        let n = ret.lastIndexOf('(');
                        ret = ret.slice(0, ++n) + op.context.mecName + ret.slice(n);
                    }
                    ret += ', __line)';
                }
                break;

            case 'ObjectExpression':
                for (const _ of e.properties) {
                    ret += await parseElement(op, _, depth + 1);
                }
                break;

            case 'ObjectPattern':
                for (const _ of e.properties) {
                    ret += await parseElement(op, _, depth + 1);
                }
                break;

            case 'Property':
                ret += op.readUntil(e.key.start);
                ret += await parseElement(op, e.key, depth + 1);
                if (e.key.start !== e.value.start) {
                    ret += op.readUntil(e.value.start);

                    if (e.value.type === 'FunctionExpression') {
                        let ctx = op.pushContext({
                            isAsync: e.value.async === true,
                            className: false,
                            callType: CallOrigin.Functional,
                            functionName: e.key.name,
                            memberName: false,
                            memberModifiers: MemberModifiers.Public,
                        }), oldMethod = op.thisMethod;

                        op.thisMethod = false;
                        ret += await parseElement(op, e.value, depth + 1);
                        op.thisMethod = oldMethod;
                        ctx.pop();
                    }
                    else {
                        ret += await parseElement(op, e.value, depth + 1);
                    }
                }
                break;

            case 'RestElement':
                ret += await parseElement(op, e.argument, depth + 1);
                op.pos = e.end;
                break;

            case 'ReturnStatement':
                if (e.argument) {
                    ret += op.readUntil(e.argument.start);
                    ret += await parseElement(op, e.argument, depth + 1);
                }
                break;

            case 'RuntimeAssertion':
                ret += e.text;
                break;

            case 'ScopedIdentifier':
                {
                    let scopeName = await parseElement(op, e.scopeName, depth + 1);
                    op.pos += 2;
                    let scopeId = await parseElement(op, e.scopeId, depth + 1);

                    if (scopeId === 'create') {
                        let ctx = op.context;

                        if (!ctx.inConstructor)
                            op.raise(`Constructor method '${MemberModifiers.ConstructorName}' may not be called here`, e);
                        if (!ctx.isThisExpression) {
                            if (ctx.isSuperExpression)
                                op.warn(`Constructor method '${MemberModifiers.ConstructorName}' should be called using 'this' keyword (not super)`, e);
                            else
                                op.raise(`Constructor method '${MemberModifiers.ConstructorName}' should only be called using 'this' keyword`, e);
                        }
                    }

                    switch (op.scope) {
                        case ScopeType.CallExpression:

                            ret += `__callScopedImplementation(${op.context.mecName}.branch({ lineNumber: __line }), '${scopeId}', '${scopeName}'`;
                            break;

                        case ScopeType.AssignmentExpression:
                            ret += `__exportScopedProperty('${scopeId}', '${scopeName}').${scopeId}`;
                            break;
                    }
                }
                break;

            case 'SwitchCase':
                ret += await parseElement(op, e.test, depth + 1);
                for (const _ of e.consequent) {
                    ret += await parseElement(op, _, depth + 1)
                }
                break;

            case 'SequenceExpression':
                for (const _ of e.expressions) {
                    ret += await parseElement(op, _, depth + 1);
                }
                break;

            //  '...' 
            case 'SpreadElement':
                ret += op.readUntil(e.argument.start);
                ret += await parseElement(op, e.argument, depth + 1);
                break;

            case 'Super':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                break;

            case 'SwitchStatement':
                ret += op.readUntil(e.discriminant.start);
                ret += await parseElement(op, e.discriminant, depth + 1);
                for (const _ of e.cases) {
                    ret += op.readUntil(_.start);
                    ret += await parseElement(op, _, depth + 1);
                }
                break;

            case 'TaggedTemplateExpression':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
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
                    for (const _ of items) {
                        ret += op.readUntil(_.start);
                        ret += await parseElement(op, _, depth + 1);
                    }
                }
                break;

            case 'ThisExpression':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                break;

            case 'ThrowStatement':
                ret += await parseElement(op, e.argument, depth + 1);
                break;

            case 'TryStatement':
                ret += await parseElement(op, e.block, depth + 1);
                ret += await parseElement(op, e.handler, depth + 1);
                ret += await parseElement(op, e.finalizer, depth + 1);
                break;

            case 'UnaryExpression':
                ret += op.readUntil(e.argument.start);
                ret += await parseElement(op, e.argument, depth + 1);
                break;

            case 'UpdateExpression':
                ret += op.source.slice(e.start, e.end);
                op.pos = e.end;
                break;

            case 'VariableDeclarator':
                ret += await parseElement(op, e.id, depth + 1);
                if (e.init) {
                    e.init.idType = e.id.type;
                    ret += op.readUntil(e.init.start);
                    ret += await parseElement(op, e.init, depth + 1);
                }
                break;

            case 'VariableDeclaration':
                for (const _ of e.declarations) {
                    if (IllegalVariableNames.indexOf(_.id.name) > -1)
                        op.raise(`${_.id.name} cannot be used as a variable name`, _.id);
                    ret += await parseElement(op, _, depth + 1);
                }
                break;

            case 'WhileStatement':
                ret += await parseElement(op, e.test, depth + 1);
                addRuntimeAssert(e, '__ala(); ', undefined, undefined, true, op);
                if (e.body.type !== 'BlockStatement') {
                    op.raise('While loop body must be a block statement');
                }
                ret += await parseElement(op, e.body, depth + 1);
                break;

            case 'WithStatement':
                ret += await parseElement(op, e.object, depth + 1);
                ret += await parseElement(op, e.body, depth + 1);
                break;

            case 'YieldExpression':
                ret += op.readUntil(e.argument.start);
                ret += await parseElement(op, e.argument, depth + 1);
                op.pos = e.end;
                break;

            default:
                op.raise(`Unhandled transpiler node type: ${e.type}`, e);
                break;
        }
        if (op.pos !== e.end) {
            if (op.pos > e.end)
                op.raise('Transpiler position advanced beyond the end of current node', e);

            // this should be done by each type so we are sure we aren't missing something
            ret += op.readUntil(e.end);
        }
    }
    return ret;
}

class MudScriptTranspiler extends PipelineComponent {
    constructor(config) {
        super(config);

        this.acornOptions = Object.assign({}, config.acornOptions);
        this.acornOptions.onComment = (block, text, start, end) => {
            /* TODO: do autodoc stuff */
            let len = end - start;
        };

        this.allowJsx = typeof config.allowJsx === 'boolean' ? config.allowJsx : true;
        this.allowLazyBindings = config.allowLazyBindings === true;
        this.config = config;
        this.extension = config.extension || '.js';
        this.parser = acorn.Parser
            .extend(jsx())
            .extend(MudscriptAcornPlugin(config));

        //  Dummy listener
        this.on('compiler', () => { });
    }

    /**
     * Transpile the source code
     * @param {ExecutionContext} ecc
     * @param {PipelineContext} context
     * @param {MUDCompilerOptions} options
     * @param {number} step
     * @param {number} maxStep
     * @returns
     */
    async runAsync(ecc, context, options, step, maxStep) {
        let frame = ecc.push({ file: __filename, method: 'runAsync', isAsync: true, callType: CallOrigin.Driver });
        let op = new MudScriptAstAssembler(Object.assign({
            acornOptions: Object.assign({ locations: true, sourceType: 'mudscript' }, this.acornOptions, context.acornOptions),
            allowConstructorKeyword: false,
            allowJsx: true,
            directory: context.directory,
            filename: context.basename,
            context,
            source: context.content,
            injectedSuperClass: 'MUDObject'
        }, options.transpilerOptions), ecc);

        op.allowLazyBindings = this.allowLazyBindings === true;
        try {
            if (this.enabled) {
                options.onDebugOutput(`\t\tRunning pipeline stage ${(step + 1)} of ${maxStep}: ${this.name}`, 3);

                let source = op.source = 'await (async () => {  ' + op.source + ' })()';
                // let source = op.source;

                op.ast = this.parser.parse(source, op.acornOptions);
                op.output += `__rmt(__mec, "${op.fullPath}");`
                for (const n of op.ast.body) {
                    op.output += await parseElement(op, n, 0)
                }
                op.output += op.readUntil(op.max);
                op.output += op.appendText;
                op.injectedSuperClass = 'MUDObject';

                if (op.errors.length > 0) {
                    let sorter = /** @param {SyntaxError} a @param {SyntaxError} b */ (a, b) => {
                        if (a instanceof SyntaxError && b instanceof SyntaxError) {
                            if (a.position.line < b.position.line)
                                return -1;
                            else if (b.position.line < a.position.line)
                                return 1;
                            else if (a.position.char < b.position.char)
                                return -1;
                            else if (b.position.char < a.position.char)
                                return -1;
                            else if (a.message < b.message)
                                return -1;
                            else if (b.message < a.message)
                                return 1;
                            else
                                return 0;
                        }
                        return 1;
                    };
                    op.errors = op.errors.sort(sorter);
                    if ((op.warningCount + op.errorCount) > 0) {
                        let msgs = op.errorCount > 0 ?
                            new CompositeError(`Module ${op.fullPath} failed to compile due to ${op.errorCount} error(s) [${op.warningCount} warning(s)]`, op.errors) :
                            new CompositeError(`Module ${op.fullPath} compiled with ${op.warningCount} warning(s)`, op.errors);

                        op.eventCompleteMessages = [msgs];

                        if (op.errorCount > 0)
                            throw msgs;
                    }
                }

                return context.update(PipeContext.CTX_RUNNING, op.finish());
            }
            else {
                options.onDebugOutput(`\t\tSkipping disabled pipeline stage ${step} of ${maxStep}: ${this.name}`, 3);
            }
        }
        catch (x) {
            if (x instanceof CompositeError) {
                console.log(x.message);
                for (const error of x.getItems()) {
                    console.log(`\t${error.message}`);
                }
            }
            else {
                console.log(`MudScriptTranspiler.run compiling ${context.basename}`, x.message);
                op.eventCompleteMessages.push(x);
            }
            throw x;
        }
        finally {
            this.emit('compiler', op.eventCompleteMessages);
            if (Array.isArray(op.eventCompleteMessages) && op.eventCompleteMessages.length > 0) {
                for (const err of op.eventCompleteMessages) {
                    await driver.callApplyAsync(frame.branch(), driver.applyLogError.name, options.file, err);
                }
            }
            frame.pop();
        }
    }
}

module.exports = MudScriptTranspiler;
