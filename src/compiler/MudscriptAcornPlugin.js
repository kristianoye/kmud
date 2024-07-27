/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Extend acorn parser to support Mudscript language features.
 */
const acorn = require('acorn'),
    AccessPublic = "public",
    AccessProtected = "protected",
    AccessPrivate = "private",
    AccessPackage = "package",

    MinEcmaVersion = 10,

    ModifierAbstract = "abstract",
    ModifierAsync = "async",
    ModifierFinal = "final",
    ModifierOverride = "override",
    ModifierStatic = "static",
    ModifierSingleton = "singleton",
    ModifierNosave = "nosave",
    ModifierOrigin = "origin",

    //  New keywords added by MudScript
    MudscriptKeywords = "abstract singleton final public private protected package override nosave",
    MemberModifiers = require("./MudscriptMemberModifiers"),
    MUDCompilerOptions = require('./MUDCompilerOptions');

var
    types$1 = acorn.tokTypes,
    keywordTypes = acorn.keywordTypes,
    skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g,
    regexpCache = {};
/**
 * 
 * @param {MUDCompilerOptions} options
 * @param {acorn.Parser} Parser
 * @returns
 */
function plugin(options, Parser) {
    if ('acornOptions' in options && options.acornOptions.ecmaVersion < MinEcmaVersion)
        throw new Error(`Incompatible ecmaVersion (requires ${MinEcmaVersion}+ > ${options.acornOptions.ecmaVersion})`);
    else if ('ecmaVersion' in options && options.ecmaVersion < MinEcmaVersion)
        throw new Error(`Incompatible ecmaVersion (requires ${MinEcmaVersion}+ > ${options.acornOptions.ecmaVersion})`);

    function DestructuringErrors() {
        this.shorthandAssign =
            this.trailingComma =
            this.parenthesizedAssign =
            this.parenthesizedBind =
            this.doubleProto =
            -1;
    }

    function kw(name, options) {
        if (options === void 0) options = {};

        options.keyword = name;
        let token = keywordTypes[name] = new acorn.TokenType(name, options);

        token.classModifier = options.classModifier || 0;

        return token;
    }

    /**
     * Convert a list of words into a regex
     * @param {string} words A space-delimited list of words
     * @returns
     */
    function wordsRegexp(words) {
        return regexpCache[words] || (regexpCache[words] = new RegExp("^(?:" + words.replace(/ /g, "|") + ")$"))
    }

    // Mark a class or class member as abstract
    types$1._abstract = kw(ModifierAbstract, { beforeExpr: true, classModifier: MemberModifiers.Abstract, memberModifier: MemberModifiers.Abstract });

    // Final class decorator
    types$1._final = kw(ModifierFinal, { beforeExpr: true, classModifier: MemberModifiers.Final, memberModifier: MemberModifiers.Final });

    // Public access modifier
    types$1._public = kw(AccessPublic, { beforeExpr: true, classModifier: 0, memberModifier: MemberModifiers.Public });

    // Protected access modifier
    types$1._protected = kw(AccessProtected, { beforeExpr: true, classModifier: 0, memberModifier: MemberModifiers.Protected });

    // Private access modifier
    types$1._private = kw(AccessPrivate, { beforeExpr: true, classModifier: 0, memberModifier: MemberModifiers.Private });

    // Private access modifier
    types$1._package = kw(AccessPackage, { beforeExpr: true, classModifier: 0, memberModifier: MemberModifiers.Package });

    // Private access modifier
    types$1._override = kw(ModifierOverride, { beforeExpr: true, classModifier: 0, memberModifier: MemberModifiers.Override });

    // Nosave access modifier
    types$1._nosave = kw(ModifierNosave, { beforeExpr: true, classModifier: 0, memberModifier: MemberModifiers.NoSave });


    // Dereferencing operator allows calling 3 types of possible instance references:
    //    instance->method(...)
    //    wrapper->method(...)
    //    "/some/literal"->method(...)
    types$1.derefArrow = new acorn.TokenType("->");

    // Scope resolution operator for "multiple inheritance"
    types$1.doubleColon = new acorn.TokenType("::");

    // Singleton class decorator--there can be only one!
    types$1._singleton = kw(ModifierSingleton, { beforeExpr: true, classModifier: MemberModifiers.Singleton });

    return class extends Parser {
        constructor(options, input, startPos) {
            super(options, input, startPos);

            this.addKeywordsToRegex(MudscriptKeywords)
        }

        /**
         * Helper that appends our custom keywords to the parser keywords regex
         * @param {string} moreWords Space-delimited list of MudScript keywords
         */
        addKeywordsToRegex(moreWords) {
            let wordTest = /^[a-z]+$/,
                existingWords = this.keywords.source
                    .split(/([a-z]+)/g)
                    .filter(w => wordTest.test(w)),
                newWords = moreWords.split(/\s+/);

            for (const word of newWords) {
                if (existingWords.indexOf(word) === -1) {
                    existingWords.push(word);
                }
            }
            this.keywords = wordsRegexp(existingWords.join(' '));
        }

        checkKeyName(node, name) {
            let computed = node.computed;
            let key = node.key;
            return !computed && (
                key.type === "Identifier" && key.name === name ||
                key.type === "Literal" && key.value === name
            )
        }

        /**
         * Eat whitespace
         * @returns {[ number, number ]} Returns previous location and number of spaces skipped
         */
        eatWhitespace() {
            let prev = skipWhiteSpace.lastIndex = this.pos;
            let spaceCount = skipWhiteSpace.exec(this.input)[0].length;

            this.pos += spaceCount;

            return [prev, spaceCount];
        }

        /**
         * Look to see if we are parsing a custom MudScript operator
         * @param {number} code
         * @returns
         */
        getTokenFromCode(code) {
            if (code === 45 && options.allowDereferenceOperator) {
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === 62) {
                    this.pos += 2;
                    return this.finishToken(types$1.derefArrow);
                }
            }
            else if (code === 58 && options.allowScopeOperator) {
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === 58) {
                    this.pos += 2;
                    return this.finishToken(types$1.doubleColon);
                }
            }
            return super.getTokenFromCode(code);
        }

        parseTypeHint() {
            const start = this.start,
                startLoc = this.startLoc,
                maxTypeLength = 512;

            if (options.allowTypeHinting && this.type === types$1.name) {
                //  Do not treat property identifiers as type hints
                if (this.value === 'get' || this.value === 'set')
                    return false;

                let typeBuffer = Buffer.alloc(maxTypeLength, 0, 'utf8'),
                    templateDepth = 0,
                    typeLength = 0,
                    wordLength = 0,
                    done = false;

                const assertValidBuffer = (i) => {
                    if (typeLength >= maxTypeLength) {
                        if (templateDepth > 0)
                            this.raise(`Read ${maxTypeLength} characters without finding end of type template`, i);
                        else
                            this.raise(`Type identifier is too long (max: ${maxTypeLength})`, i);
                    }
                };

                for (let i = start; i < this.input.length && !done; i++) {
                    let c = this.input.charAt(i);

                    //  Eat leading whitespace
                    if (' \t\n\r\v'.indexOf(c) > -1 && typeLength === 0)
                        continue;

                    switch (true) {
                        case (c === '<' || c === '>'):
                            if (options.allowGenericTypes) {
                                if (wordLength === 0)
                                    this.unexpected();
                                templateDepth += (c === '<' ? 1 : -1);
                                if (templateDepth < 0)
                                    this.unexpected();
                                assertValidBuffer(i);
                                typeBuffer.write(c, typeLength++);
                                wordLength = 0;
                            }
                            else
                                this.raise('Generic types are disabled by the compiler', i);
                            break;

                        case ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')):
                            assertValidBuffer(i);
                            typeBuffer.write(c, typeLength++);
                            wordLength++;
                            break;

                        case (c === '_' || c === '$'):
                            assertValidBuffer(i);
                            typeBuffer.write(c, typeLength++);
                            wordLength++;
                            break;

                        case (c === '[' || c === ']'):
                            if (c === '[' && wordLength === 0)
                                this.unexpected();
                            assertValidBuffer(i);
                            if (c === ']' && typeBuffer[typeLength - 1] !== '['.charCodeAt(0))
                                this.unexpected();
                            typeBuffer.write(c, typeLength++);
                            wordLength = 0;
                            break;

                        case (c >= '0' && c <= '9'):
                            if (wordLength === 0)
                                this.raise('Identifier cannot start with a digit', i);
                            assertValidBuffer(i);
                            typeBuffer.write(c, typeLength++);
                            wordLength++;
                            break;

                        case (c === ' ' || c === '\n' || c === '\r' || c === '\t'):
                            if (templateDepth > 0) {
                                assertValidBuffer(i);
                                typeBuffer.write(c, typeLength++);
                                wordLength = 0;
                            }
                            else
                                done = true;
                            break;

                        case (c === ','):
                            if (templateDepth === 0)
                                this.unexpected();
                            else if (wordLength === 0)
                                this.unexpected();
                            else {
                                assertValidBuffer(i);
                                typeBuffer.write(c, typeLength++);
                                wordLength = 0;
                            }
                            break;

                        case (c === '('):
                            //  This is not a type hint, this is a method identifier...
                            return false;
                    }
                }

                if (done) {
                    //  Look ahead to make sure this is not a method identifier...
                    let nextParan = this.input.slice(start + typeLength).indexOf('('),
                        interveningText = this.input.slice(start + typeLength, start + typeLength + nextParan),
                        hasIdentifier = /[a-zA-Z\$\_]/.test(interveningText);

                    if (hasIdentifier) {
                        let typeNode = this.startNodeAt(start, startLoc),
                            typeText = Uint8Array.prototype.slice.call(typeBuffer, 0, typeLength).toString('utf8'),
                            lineCount = typeText.split('\n').length - 1,
                            endPos = (this.pos = start + typeText.length),
                            endLoc = new acorn.Position(startLoc.line + lineCount, endPos - this.input.slice(0, endPos).lastIndexOf('\n'));

                        typeNode.typeHint = typeText;

                        this.end = endPos;

                        this.lastTokEnd = endPos;
                        this.lastTokEndLoc = endLoc;

                        this.finishNode(typeNode, "TypeHint");
                        this.next();
                        return typeNode;
                    }
                }
            }
            return false;
        }

        /**
         * This override adds support for additional member modifiers (public, private, package, protected, override)
         */
        parseClassElement(constructorAllowsSuper) {
            if (this.eat(types$1.semi)) return null;

            let method = this.startNode(),
                modifierNode = this.startNode(),
                isAsync = false;

            const tryContextual = (k, noLineBreak = false) => {
                const start = this.start, startLoc = this.startLoc;
                if (!this.eatContextual(k)) return false;
                //  If we hit the '(' then we know the word is the method key 
                if (this.type !== types$1.parenL && (!noLineBreak || !this.canInsertSemicolon())) {
                    return true;
                }
                if (method.key) this.unexpected();
                method.computed = false;
                method.key = this.startNodeAt(start, startLoc);
                method.key.name = k;
                this.finishNode(method.key, "Identifier");
                return false;
            };

            method.kind = "method";
            method.methodModifiers = 0;
            method.hasAccess = function (flag) {
                return (method.methodModifiers & flag) > 0;
            };

            this.eatWhitespace();

            while (true) {
                this.eatWhitespace();
                if (tryContextual(ModifierStatic, true)) {
                    method.static = true;
                    method.methodModifers |= MemberModifiers.Static;
                }
                else if (tryContextual(ModifierAsync, true)) {
                    method.isAsync = isAsync = true;
                    method.methodModifiers |= MemberModifiers.Async;
                }
                else if (this.eat(types$1._abstract)) {
                    method.isAbstract = true;
                    method.methodModifiers |= MemberModifiers.Abstract;
                }
                else if (this.eat(types$1._public)) {
                    method.accessKind = 'public';
                    method.isPublic = true;
                    method.methodModifiers |= MemberModifiers.Public;
                }
                else if (this.eat(types$1._protected)) {
                    method.accessKind = 'protected';
                    method.isProtected = true;
                    method.methodModifiers |= MemberModifiers.Protected
                }
                else if (this.eat(types$1._private)) {
                    method.accessKind = 'private';
                    method.isPrivate = true;
                    method.methodModifiers |= MemberModifiers.Private;
                }
                else if (this.eat(types$1._package)) {
                    method.accessKind = 'package';
                    method.isPackage = true;
                    method.methodModifiers |= MemberModifiers.Package;
                }
                else if (this.eat(types$1._override)) {
                    method.methodModifiers |= MemberModifiers.Override;
                }
                else if (this.eat(types$1._final)) {
                    method.methodModifiers |= MemberModifiers.Final;
                }
                else if (this.eat(types$1._nosave)) {
                    method.methodModifiers |= MemberModifiers.NoSave;
                }
                else if (tryContextual(ModifierOrigin, true)) {
                    method.methodModifiers |= MemberModifiers.Origin;
                }
                else {
                    this.finishNode(modifierNode, 'MemberModifiers');
                    if (modifierNode.end < modifierNode.start)
                        modifierNode.end = modifierNode.start;

                    modifierNode.raw = this.input.slice(modifierNode.start, modifierNode.end);
                    modifierNode.keywords = modifierNode.raw ? modifierNode.raw.split(/\s+/).map(s => s.trim()) : [];
                    modifierNode.value = method.methodModifiers;

                    break;
                }
            }

            method.accessKind = method.accessKind || options.defaultAccessModifier;
            method.modifier = modifierNode;

            let isGenerator = this.eat(types$1.star);

            if (!isGenerator && !isAsync) {
                if (tryContextual("get")) {
                    method.kind = "get";
                } else if (tryContextual("set")) {
                    method.kind = "set";
                }
            }
            if (!method.key)
                this.parsePropertyName(method);
            let { key } = method;
            let allowsDirectSuper = false;
            if (!method.computed && !method.static && (key.type === "Identifier" && key.name === "constructor" ||
                key.type === "Literal" && key.value === "constructor" || key.type === "Identifier" && key.name === options.constructorName)) {
                if (key.type === "Identifier" && key.name === "constructor" && options.allowConstructorKeyword === false)
                    this.raise(key.start, `Keyword 'constructor' is not allowed; Use '${options.constructorName}' instead`);
                if (method.kind !== "method") this.raise(key.start, "Constructor can't have get/set modifier");
                if (isGenerator) this.raise(key.start, "Constructor can't be a generator");
                if (isAsync && options.allowAsyncConstructors === false) {
                    this.raise(key.start, "Constructor can't be an async method");
                }
                method.kind = "constructor";
                allowsDirectSuper = constructorAllowsSuper;
            } else if (method.static && key.type === "Identifier") {
                if (key.name === "prototype")
                    this.raise(key.start, "Classes may not have a static property named prototype");
            }
            this.parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper);
            if (method.kind === "get" && method.value.params.length !== 0)
                this.raiseRecoverable(method.value.start, "getter should have no params");
            if (method.kind === "set" && method.value.params.length !== 1)
                this.raiseRecoverable(method.value.start, "setter should have exactly one param");
            if (method.kind === "set" && method.value.params[0].type === "RestElement")
                this.raiseRecoverable(method.value.params[0].start, "Setter cannot use rest params");
            if (method.isFinal && method.isAbstract)
                this.raise(method.value.start, "Member cannot be both final and abstract");
            else if (method.isPrivate && method.isAbstract)
                this.raise(method.value.start, "Member cannot be both private and abstract");

            if (options.requireAccessModifiers && !method.accessKind) {
                if (method.kind === "get")
                    this.raise(method.value.start, `Getter '${key.name}' must specify access decorator (public, protected, private, or package)`);
                else if (method.kind === "set")
                    this.raise(method.value.start, `Setter '${key.name}' must specify access decorator (public, protected, private, or package)`);
                else if (method.kind === "method")
                    this.raise(method.value.start, `Method '${key.name}' must specify access decorator (public, protected, private, or package)`);
                else if (method.kind === "constructor")
                    this.raise(method.value.start, "Constructor must specify access decorator (public, protected, private, or package)");
            }
            if (method.hasAccess(MemberModifiers.Origin) && method.kind !== 'set' && method.kind !== 'get')
                this.raise(`Member ${key.name} cannot use origin modifier; Only property getters/setters may use origin`);
            if (method.hasAccess(MemberModifiers.NoSave) && method.kind !== 'set')
                this.raise(`Member ${key.name} cannot use nosave modifier; Only setters may use nosave`);
            if (method.hasAccess(MemberModifiers.Public) && method.hasAccess(MemberModifiers.Private | MemberModifiers.Protected | MemberModifiers.Package))
                this.raise(`Member ${key.name} cannot mix public acccess with protected, private, or package`);
            else if (method.hasAccess(MemberModifiers.Abstract) && method.hasAccess(MemberModifiers.Final))
                this.raise(`Member ${key.name} cannot mix public acccess with protected, private, or package`);
            return method;
        }

        parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper) {
            // Check key and flags
            var key = method.key;
            if (method.kind === "constructor") {
                if (isGenerator) { this.raise(key.start, "Constructor can't be a generator"); }
                if (isAsync && options.allowAsyncConstructors === false) { this.raise(key.start, "Constructor can't be an async method"); }
            }
            else if (method.static && this.checkKeyName(method, "prototype")) {
                this.raise(key.start, "Classes may not have a static property named prototype");
            }

            // Parse value
            var value = method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);

            // Check value
            if (method.kind === "get" && value.params.length !== 0) { this.raiseRecoverable(value.start, "getter should have no params"); }
            if (method.kind === "set" && value.params.length !== 1) { this.raiseRecoverable(value.start, "setter should have exactly one param"); }
            if (method.kind === "set" && value.params[0].type === "RestElement") { this.raiseRecoverable(value.params[0].start, "Setter cannot use rest params"); }

            return this.finishNode(method, "MethodDefinition")
        }

        parseExportDefaultDeclaration() {
            let classNode = this.tryParseClass(false, false, false);

            if (classNode)
                return classNode;
            else
                return super.parseExportDefaultDeclaration();
        }
        /**
         * Needed to override to allow to use '->' deref operator
         */
        parseExprAtom(refDestructuringErrors, forInit, forNew) {
            // If a division operator appears in an expression position, the
            // tokenizer got confused, and we force it to read a regexp instead.
            if (this.type === types$1.slash) { this.readRegexp(); }

            var node, classNode = this.tryParseClass(false, false, false);

            if (classNode)
                return classNode;

            switch (this.type) {
                case types$1._super:
                    if (!this.allowSuper) { this.raise(this.start, "'super' keyword outside a method"); }
                    node = this.startNode();
                    this.next();
                    if (this.type === types$1.parenL && !this.allowDirectSuper) { this.raise(node.start, "super() call outside constructor of a subclass"); }
                    // The `super` keyword can appear at below:
                    // SuperProperty:
                    //     super [ Expression ]
                    //     super . IdentifierName
                    // SuperCall:
                    //     super ( Arguments )
                    if (this.type !== types$1.dot && this.type !== types$1.bracketL && this.type !== types$1.parenL && this.type !== types$1.derefArrow) { this.unexpected(); }
                    return this.finishNode(node, "Super");

                default:
                    return super.parseExprAtom(refDestructuringErrors, forInit, forNew);
            }
        }

        /**
         * Override required to parse ScopedIdentifier nodes
         */
        parseIdent(liberal, allowScoping=true) {
            let startPos = this.pos;

            if (this.eat(types$1.doubleColon)) {
                let scopeName = this.startNode();
                let scopedId = this.parseIdentNode();

                this.finishNode(scopeName, 'Identifier'); // should be ''
                this.next(!!liberal);
                this.finishNode(scopedId);

                let scopedNode = this.startNode();

                scopedNode.scopeName = scopeName;
                scopedNode.scopeId = scopedId;

                this.finishNode(scopedId, "Identifier");
                this.finishNode(scopedNode, "ScopedIdentifier");

                scopedNode.start = scopeName.start = scopeName.end = startPos - 2;
                if (options.allowScopedIdentifiers === false)
                    this.raise(scopedNode.start, 'Scoped identifiers are disabled in the compiler options');
                else if (allowScoping === false)
                    this.raise(scopedNode.start, 'Scoped identifiers are not allowed in this context');
                return scopedNode;
            }

            var node = this.parseIdentNode();

            this.next(!!liberal);
            this.finishNode(node, "Identifier");

            if (this.eat(types$1.doubleColon)) {
                let scopedId = this.parseIdentNode();
                this.next(!!liberal);
                this.finishNode(scopedId);

                let scopedNode = this.startNode();

                scopedNode.scopeName = node;
                scopedNode.scopeId = scopedId;

                this.finishNode(scopedId, "Identifier");
                this.finishNode(scopedNode, "ScopedIdentifier");

                scopedNode.start = node.start;
                node = scopedNode;
                if (options.allowScopedIdentifiers === false)
                    this.raise(scopedNode.start, 'Scoped identifiers are disabled in the compiler options');
                else if (allowScoping === false)
                    this.raise(scopedNode.start, 'Scoped identifiers are not allowed in this context');
            }
            if (!liberal) {
                this.checkUnreserved(node);
                if (node.name === "await" && !this.awaitIdentPos) { this.awaitIdentPos = node.start; }
            }
            return node
        }

        parseImport(node) {
            this.next();

            // import '...'
            if (this.type === types$1.string) {
                node.specifiers = empty$1;
                node.source = this.parseExprAtom();
            }
            else {
                node.specifiers = this.parseImportSpecifiers();
                this.expectContextual("from");

                if (this.type === types$1.name)
                    node.source = this.parseIdent(undefined, false);
                else if (this.type === types$1.string)
                    node.source = this.parseExprAtom();
                else
                    this.unexpected();
            }
            this.semicolon();
            return this.finishNode(node, "ImportDeclaration")
        }

        /**
         * Override to add support for class modifiers (final, abstract, singleton)
         */
        parseStatement(context, topLevel, exports) {
            var starttype = this.type,
                classNode = this.tryParseClass(false, true, context);

            if (classNode)
                return classNode;
            else if (starttype === types$1._export || starttype === types$1._import) {
                let node = this.startNode()
                if (this.options.ecmaVersion > 10 && starttype === types$1._import) {
                    skipWhiteSpace.lastIndex = this.pos;
                    var skip = skipWhiteSpace.exec(this.input);
                    var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
                    if (nextCh === 40 || nextCh === 46) // '(' or '.'
                    { return this.parseExpressionStatement(node, this.parseExpression()) }
                }
                return starttype === types$1._import ? this.parseImport(node) : this.parseExport(node, exports)
            }
            else
                return super.parseStatement(context, topLevel, exports);
        }

        /**
         * Override adds support for -> dereferencing aka CallOther arrow
         */
        parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit) {
            var optionalSupported = this.options.ecmaVersion >= 11;
            var optional = optionalSupported && this.eat(types$1.questionDot);
            var isDerefCall = false;

            if (noCalls && optional) { this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions"); }

            var computed = this.eat(types$1.bracketL);
            if (computed || (optional && this.type !== types$1.parenL && this.type !== types$1.backQuote) || this.eat(types$1.dot) || (isDerefCall = this.eat(types$1.derefArrow))) {
                var node = this.startNodeAt(startPos, startLoc);
                node.object = base;
                node.usingDerefArrow = isDerefCall;

                if (computed) {
                    node.property = this.parseExpression();
                    this.expect(types$1.bracketR);
                } else if (this.type === types$1.privateId && base.type !== "Super") {
                    node.property = this.parsePrivateIdent();
                } else {
                    node.property = this.parseIdent(this.options.allowReserved !== "never");
                }
                node.computed = !!computed;
                if (optionalSupported) {
                    node.optional = optional;
                }
                base = this.finishNode(node, "MemberExpression");
            } else if (!noCalls && this.eat(types$1.parenL)) {
                var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
                this.yieldPos = 0;
                this.awaitPos = 0;
                this.awaitIdentPos = 0;
                var exprList = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors);
                if (maybeAsyncArrow && !optional && this.shouldParseAsyncArrow()) {
                    this.checkPatternErrors(refDestructuringErrors, false);
                    this.checkYieldAwaitInDefaultParams();
                    if (this.awaitIdentPos > 0) { this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function"); }
                    this.yieldPos = oldYieldPos;
                    this.awaitPos = oldAwaitPos;
                    this.awaitIdentPos = oldAwaitIdentPos;
                    return this.parseSubscriptAsyncArrow(startPos, startLoc, exprList, forInit)
                }
                this.checkExpressionErrors(refDestructuringErrors, true);
                this.yieldPos = oldYieldPos || this.yieldPos;
                this.awaitPos = oldAwaitPos || this.awaitPos;
                this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;
                var node$1 = this.startNodeAt(startPos, startLoc);
                node$1.callee = base;
                node$1.arguments = exprList;
                if (optionalSupported) {
                    node$1.optional = optional;
                }
                base = this.finishNode(node$1, "CallExpression");
            } else if (this.type === types$1.backQuote) {
                if (optional || optionalChained) {
                    this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions");
                }
                var node$2 = this.startNodeAt(startPos, startLoc);
                node$2.tag = base;
                node$2.quasi = this.parseTemplate({ isTagged: true });
                base = this.finishNode(node$2, "TaggedTemplateExpression");
            }
            return base
        }

        /**
         * Parse out all superclasses
         * @param {any} node
         */
        parseClassSuper(node) {
            node.superClass = this.eat(types$1._extends) ? this.parseExprSubscripts(null, false) : null;
            node.parentClasses = [];

            if (options.allowMultipleInheritance && node.superClass !== null) {
                node.parentClasses.push(node.superClass);
                this.eatWhitespace();
                while (this.eat(types$1.comma)) {
                    let otherClass = this.parseExprSubscripts(null, false);
                    node.parentClasses.push(otherClass);
                    this.eatWhitespace();
                }
            }
        }

        parseCallExpressionArguments() {
            return this.parseExprList(
                acorn.tokTypes.parenL,
                acorn.tokTypes.parenR,
                this.options.ecmaVersion >= 6,
                false,
                null
            );
        }

        parseExprList(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
            var elts = [], first = true;
            if (close === types$1.parenR) {
                let n = this.pos;
                if (this.type === types$1.parenR) {
                    while (this.input.charAt(n) !== '(') n--;
                }
                else {
                    while (this.input.charAt(n) !== '(') n++;
                }
                elts.start = n;
            }
            while (!this.eat(close)) {
                if (!first) {
                    this.expect(types$1.comma);
                    if (allowTrailingComma && this.afterTrailingComma(close)) { break }
                } else { first = false; }

                var elt = (void 0);
                if (allowEmpty && this.type === types$1.comma) { elt = null; }
                else if (this.type === types$1.ellipsis) {
                    elt = this.parseSpread(refDestructuringErrors);
                    if (refDestructuringErrors && this.type === types$1.comma && refDestructuringErrors.trailingComma < 0) { refDestructuringErrors.trailingComma = this.start; }
                } else {
                    elt = this.parseMaybeAssign(false, refDestructuringErrors);
                }
                elts.push(elt);
            }
            return elts
        }

        shouldParseExportStatement() {
            return this.type.keyword === "var" ||
                this.type.keyword === 'abstract' ||
                this.type.keyword === 'final' ||
                this.type.keyword === 'singleton' ||
                this.type.keyword === "const" ||
                this.type.keyword === "class" ||
                this.type.keyword === "function" ||
                this.isLet() ||
                this.isAsyncFunction()
        }

        tryParseClass(node, isStatement, context) {
            let starttype = this.type,
                classModifiers = 0,
                classNode = this.startNode(),
                modifierNode = this.startNode();

            while (starttype === types$1._final || starttype === types$1._abstract || starttype === types$1._singleton) {
                classModifiers |= starttype.classModifier;
                let endOfModifier = skipWhiteSpace.lastIndex = this.pos;

                this.pos += skipWhiteSpace.exec(this.input)[0].length;
                this.next();
                starttype = this.type;

                if (starttype !== types$1._final && starttype !== types$1._abstract && starttype !== types$1._singleton) {
                    modifierNode.raw = this.input.slice(modifierNode.start, endOfModifier);
                }
            }
            if (modifierNode.start > modifierNode.end) {
                modifierNode.end = modifierNode.start;
                modifierNode.raw = '';
            }

            classNode.modifier = this.finishNode(modifierNode, "ClassModifiers");

            if (classModifiers > 0 && starttype !== types$1._class)
                this.raise("Expected class declaration");

            if (starttype === types$1._class) {
                classNode.classModifiers = classModifiers;
                if ((classNode.classModifiers & MemberModifiers.Abstract) && classNode.classModifiers !== MemberModifiers.Abstract)
                    this.raise('Abstract classes may not also be singletons nor final');
                if (context) { this.unexpected(); }
                return this.parseClass(classNode, true);
            }
            return false;
        }
    }
}

module.exports = function (optionsIn) {
    return function (Parser) {
        return plugin(Object.assign({
            allowAccessModifiers: true,
            allowDereferenceOperator: true,
            allowGenericTypes: true,
            allowLazyBinding: true,
            allowMultipleInheritance: true,
            allowScopeOperator: true,
            allowStaticProperties: true,
            allowPackageModifier: true,
            allowTypeHinting: true,
            defaultAccessModifier: MemberModifiers.ParseMemberAccess(optionsIn.defaultAccessModifier || MemberModifiers.Public),
            requireAccessModifiers: false,
            allowIncludes: true
        }, optionsIn), Parser);
    };
};
