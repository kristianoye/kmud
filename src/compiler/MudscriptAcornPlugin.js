const { stubArray } = require('lodash');

/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Extend acorn parser to support Mudscript language fatures.
 */
const acorn = require('acorn'),
    AccessPublic = "public",
    AccessProtected = "protected",
    AccessPrivate = "private",
    AccessPackage = "package",

    ModifierAbstract = "abstract",
    ModifierAsync = "async",
    ModifierFinal = "final",
    ModifierOverride = "override",
    ModifierStatic = "static",

    //  New keywords added by MudScript
    MudscriptKeywords = "abstract singleton final public private protected package override",
    memberDecorations = [AccessPublic, AccessProtected, AccessPrivate, AccessPackage, ModifierAbstract, ModifierFinal, ModifierStatic, ModifierOverride],
    securityDecorations = [AccessPublic, AccessProtected, AccessPrivate, AccessPackage],
    MemberModifiers = Object.freeze({
        Public: 1 << 0,
        Protected: 1 << 1,
        Private: 1 << 2,
        Package: 1 << 3,
        Abstract: 1 << 4,
        Final: 1 << 5,
        Override: 1 << 6
    }),
    ClassModifiers = Object.freeze({
        Abstract: 1,
        Final: 2,
        Singleton: 4
    });

var
    types$1 = acorn.tokTypes,
    keywordTypes = acorn.keywordTypes,
    skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g,
    regexpCache = {};

function plugin(options, Parser) {
    if ('acornOptions' in options && options.acornOptions.ecmaVersion < 8)
        throw new Error('Incompatible ecmaVersion (requires 8+)');
    else if ('ecmaVersion' in options && options.ecmaVersion < 8)
        throw new Error('Incompatible ecmaVersion (requires 8+)');

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
    types$1._abstract = kw("abstract", { beforeExpr: true, classModifier: ClassModifiers.Abstract, memberModifier: MemberModifiers.Abstract });

    // Final class decorator
    types$1._final = kw("final", { beforeExpr: true, classModifier: ClassModifiers.Final, memberModifier: MemberModifiers.Final });

    // Public access modifier
    types$1._public = kw("public", { beforeExpr: true, classModifier: 0, memberModifier: MemberModifiers.Public });

    // Protected access modifier
    types$1._protected = kw("protected", { beforeExpr: true, classModifier: 0, memberModifier: MemberModifiers.Protected });

    // Private access modifier
    types$1._private = kw("private", { beforeExpr: true, classModifier: 0, memberModifier: MemberModifiers.Private });

    // Private access modifier
    types$1._package = kw("package", { beforeExpr: true, classModifier: 0, memberModifier: MemberModifiers.Package });

    // Private access modifier
    types$1._override = kw("override", { beforeExpr: true, classModifier: 0, memberModifier: MemberModifiers.Override });


    // Dereferencing operator allows calling 3 types of possible instance references:
    //    instance->method(...)
    //    wrapper->method(...)
    //    "/some/literal"->method(...)
    types$1.derefArrow = new acorn.TokenType("->");

    // Scope resolution operator for "multiple inheritance"
    types$1.doubleColon = new acorn.TokenType("::");

    // Keyword 'uses' allows inheritance of mixins
    types$1._usesMixins = new acorn.TokenType("uses", { beforeExpr: true });

    // Singleton class decorator--there can be only one!
    types$1._singleton = kw("singleton", { beforeExpr: true, classModifier: ClassModifiers.Singleton });

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
                if (existingWords.indexOf(word) ===  -1) {
                    existingWords.push(word);
                }
            }
            this.keywords = wordsRegexp(existingWords.join(' '));
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

            this.eatWhitespace();

            while (true) {
                this.eatWhitespace();
                if (tryContextual('static', true)) {
                    method.static = true;
                }
                else if (tryContextual('async', true)) {
                    method.isAsync = isAsync = true;
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
                else {
                    this.finishNode(modifierNode, 'MemberModifiers');
                    if (modifierNode.end < modifierNode.start)
                        modifierNode.end = modifierNode.start;

                    modifierNode.raw = this.input.slice(modifierNode.start, modifierNode.end);
                    modifierNode.keywords = modifierNode.raw.split(/\s+/).map(s => s.trim());
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
            if (!method.key) this.parsePropertyName(method);
            let { key } = method;
            let allowsDirectSuper = false;
            if (!method.computed && !method.static && (key.type === "Identifier" && key.name === "constructor" ||
                key.type === "Literal" && key.value === "constructor")) {
                if (method.kind !== "method") this.raise(key.start, "Constructor can't have get/set modifier");
                if (isGenerator) this.raise(key.start, "Constructor can't be a generator");
                if (isAsync) this.raise(key.start, "Constructor can't be an async method");
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
            return method;
        }

        /**
         * Needed to override to allow to use '->' deref operator
         */
        parseExprAtom(refDestructuringErrors, forInit, forNew) {
            // If a division operator appears in an expression position, the
            // tokenizer got confused, and we force it to read a regexp instead.
            if (this.type === types$1.slash) { this.readRegexp(); }

            var node, canBeArrow = this.potentialArrowAt === this.start;
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
         * Override to add support for class modifiers (final, abstract, singleton)
         */
        parseStatement(context, topLevel, exports) {
            var starttype = this.type,
                classModifiers = 0,
                classNode = void 0,
                modifierNode = void 0;

            while (starttype === types$1._final || starttype === types$1._abstract || starttype === types$1._singleton) {
                if (!classNode) {
                    modifierNode = this.startNode();
                    classNode = this.startNode();
                }

                classModifiers |= starttype.classModifier;
                let endOfModifier = skipWhiteSpace.lastIndex = this.pos;

                this.pos += skipWhiteSpace.exec(this.input)[0].length;
                this.next();
                starttype = this.type;

                if (starttype !== types$1._final && starttype !== types$1._abstract && starttype !== types$1._singleton) {
                    modifierNode.raw = this.input.slice(modifierNode.start, endOfModifier);
                    classNode.modifier = this.finishNode(modifierNode, "ClassModifiers");
                }
            }
            if (classModifiers > 0 && starttype !== types$1._class)
                this.raise("Expected class declaration");

            if (starttype === types$1._class) {
                var node = classNode || this.startNode();
                node.classModifiers = classModifiers;
                if ((node.classModifiers & ClassModifiers.Abstract) && node.classModifiers !== ClassModifiers.Abstract)
                    this.raise('Abstract classes may not also be singletons nor final');
                if (context) { this.unexpected(); }
                return this.parseClass(node, true);
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
    };
}

module.exports = function (optionsIn) {
    return function (Parser) {
        return plugin(Object.assign({
            allowAccessModifiers: true,
            allowDereferenceOperator: true,
            allowLazyBinding: true,
            allowMultipleInheritance: true,
            allowScopeOperator: true,
            allowStaticProperties: true,
            allowPackageModifier: true,
            defaultAccessModifier: "public",
            requireAccessModifiers: false,
            allowIncludes: true
        }, optionsIn), Parser);
    };
};

//module.exports.tokTypes = tokenTypes;
