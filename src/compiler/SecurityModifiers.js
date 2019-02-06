/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Eventually this might allow for access modifier keywords
 * like 'public', 'private', and 'protected'.
 */
const acorn = require('acorn');

const
    tt = acorn.tokTypes;

function plugin(options, Parser) {
    return class extends Parser {
        parseClassElement(constructorAllowsSuper) {
            if (this.eat(tt.semi)) return null;

            let method = this.startNode();
            const tryContextual = (k, noLineBreak = false) => {
                const start = this.start, startLoc = this.startLoc;
                if (!this.eatContextual(k)) return false;
                if (this.type !== tt.parenL && (!noLineBreak || !this.canInsertSemicolon())) {
                    if (["public", "protected", "private", "package"].indexOf(k) > -1) {
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
            if (tryContextual("private")) {
                method.accessKind = "private";
            }
            else if (tryContextual("protected")) {
                method.accessKind = "protected";
            }
            else if (tryContextual("package")) {
                method.accessKind = "package";
            }
            else if (tryContextual("public")) {
                method.accessKind = "public";
            }
            else {
                method.accessKind = options.defaultAccessModifier || "public";
            }
            method.static = tryContextual("static");
            let isGenerator = this.eat(tt.star);
            let isAsync = false;
            if (!isGenerator) {
                if (this.options.ecmaVersion >= 8 && tryContextual("async", true)) {
                    isAsync = true;
                    isGenerator = this.options.ecmaVersion >= 9 && this.eat(tt.star);
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
                if (method.accessKind !== 'public') this.raise(key.start, "Constructor must be public");
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
            return method;
        }

        parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper) {
            method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);
            return this.finishNode(method, "MethodDefinition");
        }
        //readToken(code) {
        //    let context = this.curContext();
        //    if (options.allowAccessModifiers) {
        //        if (code === 112) {
        //            let word = this.input.slice(this.pos, this.pos + 9);
        //            if (word === 'protected') {
        //                /* public thingy */
        //            }
        //            else if (word.slice(0, -3) === 'public') {
        //                /* public thingy */
        //            }
        //            else if (word.slice(0, -2) === 'private') {
        //                /* private thingy */
        //                this.pos += 7;
        //                return this.finishToken(tok.kmudPrivate);
        //            }
        //            else if (options.allowPackageModifier && word.slice(0, -2) === 'package') {
        //                /* package thingy */
        //                this.pos += 7;
        //                return this.finishToken(tok.kmudPackage);
        //            }
        //        }
        //    }
        //    return super.readToken(code);
        //}
    };
}

module.exports = function (optionsIn) {
    return function (Parser) {
        let options = Object.assign({}, optionsIn);
        return plugin({
            allowAccessModifiers: true,
            allowStaticProperties: true,
            allowPackageModifier: true,
            requireAccessModifiers: false
        }, Parser);
    };
};


