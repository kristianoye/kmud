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
    ModifierFinal = "final",
    ModifierOverride = "override",
    ModifierStatic = "static",
    MudscriptKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this const class extends export import super abstract singleton final",
    memberDecorations = [AccessPublic, AccessProtected, AccessPrivate, AccessPackage, ModifierAbstract, ModifierFinal, ModifierStatic, ModifierOverride],
    securityDecorations = [AccessPublic, AccessProtected, AccessPrivate, AccessPackage],
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
    types$1._abstract = kw("abstract", { beforeExpr: true, classModifier: ClassModifiers.Abstract });

    // Dereferencing operator allows calling 3 types of possible instance references:
    //    instance->method(...)
    //    wrapper->method(...)
    //    "/some/literal"->method(...)
    types$1.derefArrow = new acorn.TokenType("->");

    // Scope resolution operator for "multiple inheritance"
    types$1.doubleColon = new acorn.TokenType("::");

    // Final class decorator
    types$1._final = kw("final", { beforeExpr: true, classModifier: ClassModifiers.Final });

    // Keyword 'uses' allows inheritance of mixins
    types$1._usesMixins = new acorn.TokenType("uses", { beforeExpr: true });

    // Singleton class decorator--there can be only one!
    types$1._singleton = kw("singleton", { beforeExpr: true, classModifier: ClassModifiers.Singleton });

    return class extends Parser {
        constructor(options, input, startPos) {
            super(options, input, startPos);

            this.keywords = wordsRegexp(MudscriptKeywords);
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

        parseClassMixins(node) {
            if (this.eat(types$1._usesMixins)) {
                node.mixins = this.parseExprSubscripts(null, false);
                return true;
            } 
            node.mixins = [];
            return false;
        }

        parseClass(node, isStatement) {
            this.next();

            // ecma-262 14.6 Class Definitions
            // A class definition is always strict mode code.
            var oldStrict = this.strict;
            this.strict = true;

            this.parseClassId(node, isStatement);
            this.parseClassSuper(node);
            this.parseClassMixins(node);

            var privateNameMap = this.enterClassBody();
            var classBody = this.startNode();
            var hadConstructor = false;
            classBody.body = [];
            this.expect(types$1.braceL);
            while (this.type !== types$1.braceR) {
                var element = this.parseClassElement(node.superClass !== null);
                if (element) {
                    classBody.body.push(element);
                    if (element.type === "MethodDefinition" && element.kind === "constructor") {
                        if (hadConstructor) { this.raiseRecoverable(element.start, "Duplicate constructor in the same class"); }
                        hadConstructor = true;
                    } else if (element.key && element.key.type === "PrivateIdentifier" && isPrivateNameConflicted(privateNameMap, element)) {
                        this.raiseRecoverable(element.key.start, ("Identifier '#" + (element.key.name) + "' has already been declared"));
                    }
                }
            }
            this.strict = oldStrict;
            this.next();
            node.body = this.finishNode(classBody, "ClassBody");
            this.exitClassBody();
            return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression")
        }

        parseClassElement(constructorAllowsSuper) {
            if (this.eat(types$1.semi)) return null;

            let method = this.startNode();
            const tryContextual = (k, noLineBreak = false) => {
                const start = this.start, startLoc = this.startLoc;
                if (!this.eatContextual(k)) return false;
                if (this.type !== types$1.parenL && (!noLineBreak || !this.canInsertSemicolon())) {
                    if (securityDecorations.indexOf(k) > -1) {
                        method.access = this.startNodeAt(start, startLoc);
                        method.access.name = k;
                        this.finishNode(method.access, "AccessSpecifier");
                    }
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
            let foundDecorator = false,
                decorators = memberDecorations.slice(0);

            do {
                foundDecorator = false;
                for (let i = 0; i < decorators.length; i++) {
                    let decorator = decorators[i];
                    if (tryContextual(decorator)) {
                        switch (decorator) {
                            case AccessPrivate:
                            case AccessProtected:
                            case AccessPackage:
                            case AccessPublic:
                                if (method.accessKind)
                                    this.raise(this.pos, `Method item cannot be both ${method.accessKind} AND ${decorator}`);
                                method.accessKind = decorator;
                                break;

                            case ModifierAbstract:
                                method.isAbstract = true;
                                break;

                            case ModifierFinal:
                                method.isFinal = true;
                                break;

                            case ModifierOverride:
                                method.isOverride = true;
                                break;

                            case ModifierStatic:
                                method.static = true;
                                break;
                        }
                        foundDecorator = true;

                        //  Do not look for this decorator again
                        decorators.splice(i, 1);
                        break;
                    }
                }
            }
            while (foundDecorator);

            method.accessKind = method.accessKind || options.defaultAccessModifier;

            let isGenerator = this.eat(types$1.star);
            let isAsync = false;

            if (!isGenerator) {
                if (this.options.ecmaVersion >= 8 && tryContextual("async", true)) {
                    isAsync = true;
                    isGenerator = this.options.ecmaVersion >= 9 && this.eat(types$1.star);
                } else if (tryContextual("get")) {
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

        parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper) {
            method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);
            return this.finishNode(method, "MethodDefinition");
        }

        updateContext(prevType) {
            return super.updateContext(prevType);
        }

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

        parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit) {
            var optionalSupported = this.options.ecmaVersion >= 11;
            var optional = optionalSupported && this.eat(types$1.questionDot);
            if (noCalls && optional) { this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions"); }

            var computed = this.eat(types$1.bracketL);
            if (computed || (optional && this.type !== types$1.parenL && this.type !== types$1.backQuote) || this.eat(types$1.dot)) {
                var node = this.startNodeAt(startPos, startLoc);
                node.object = base;
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
