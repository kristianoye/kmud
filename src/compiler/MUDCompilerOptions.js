/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const MemberModifiers = require("./MudscriptMemberModifiers");

/**
 * The cached constructor name
 * @type {string}
 */
var ConstructorName = false;

/**
 * The cached default member access
 * @type {number}
 */
var DefaultMemberAccess = false;

class MUDCompilerOptions {
    /**
     * Construct the compiler options
     * @param {Partial<MUDCompilerOptions>} options
     */
    constructor(options) {
        /**
         * Should we allow async constructors?
         * Types with async constructors can only be instanciated in async contexts
         * @type {boolean}
         */
        this.allowAsyncConstructors = typeof options.allowAsyncConstructors === 'boolean' ? options.allowAsyncConstructors === true : true;

        /**
         * Should we allow the use of the 'constructor' keyword?
         * If enabled, 'constructor' will be replaced with our own constructor name
         * @type {boolean}
         */
        this.allowConstructorKeyword = typeof options.allowConstructorKeyword === 'boolean' ? options.allowConstructorKeyword === true : true;

        /**
         * Should we allow the use of the eval() functionality?
         * @type {boolean}
         */
        this.allowEval = typeof options.allowEval === 'boolean' ? options.allowEval === true : false;

        /**
         * Should we allow React-like JSX?
         * @type {boolean}
         */
        this.allowJsx = typeof options.allowJsx === 'boolean' ? options.allowJsx === true : true;

        /**
         * Should we allow lazy bindings?
         * @type {boolean}
         */
        this.allowLazyBindings = options.allowLazyBindings === true;

        /**
         * Should we auto inject missing constructors?
         * @type {boolean}
         */
        this.allowLazyConstructors = typeof options.allowLazyConstructors === 'boolean' ? options.allowLazyConstructors === true : true;

        /**
         * Should we allow multiple inheritance?
         * @type {boolean}
         */
        this.allowMultipleInheritance = typeof options.allowMultipleInheritance === 'boolean' ? options.allowMultipleInheritance : true;

        /**
         * Should we allow scoped identifiers?  This only applies if multiple inheritance is enabled
         * @type {boolean}
         */
        this.allowScopedIdentifiers = this.allowMultipleInheritance && typeof options.allowMultipleInheritance === 'boolean' ? options.allowMultipleInheritance : true;

        /**
         * Should we allow type identifiers?
         * @type {boolean}
         */
        this.allowTypeHinting = typeof options.allowTypeHinting === 'boolean' ? options.allowTypeHinting : true;

        /**
         * This allows the compiler to override the injectedSuperClass option for special cases like SimulEfuns
         * @type {MUDObject}
         */
        this.altParent = options.altParent;

        /**
         * Arguments to pass to the constructor of the default instance created.
         * @type {any[]}
         */
        this.args = Array.isArray(options.args) ? options.args : [];

        /**
         * The member name we shall be using as our constructor name in the final code
         * WARNING: Change this at your own risk
         * @type {string}
         */
        this.constructorName = ConstructorName || (typeof options.constructorName === 'string' ? MUDCompilerOptions.validateConstructorName(options.constructorName) : 'create');

        //  Cache this since it should not change again during runtime
        if (!ConstructorName) {
            ConstructorName = this.constructorName;
        }

        /**
         * The default access modifier for class members
         * @type {number}
         */
        this.defaultMemberAccess = DefaultMemberAccess || MemberModifiers.ParseMemberAccess(options.defaultMemberAccess || MemberModifiers.Public);

        //  Cache this since it should not change again during runtime
        if (!DefaultMemberAccess) {
            DefaultMemberAccess = this.defaultMemberAccess;
        }

        /**
         * The file to compile
         * @type {string}
         */
        this.file = options.file;

        /**
         * Should we generate a source map file?
         * @type {boolean}
         */
        this.generateSourceMap = typeof options.generateSourceMap === 'boolean' ? options.generateSourceMap === true : false;

        /**
         * The default, injected super class
         * @type {string}
         */
        this.injectedSuperClass = typeof this.injectedSuperClass === 'string' ? this.injectedSuperClass : 'MUDObject';

        /**
         * Is this a request to compile a virtual object?
         * @type {boolean}
         */
        this.isVirtual = typeof options.isVirtual === 'boolean' ? options.isVirtual === true : false;

        /**
         * No instances are created automatically by the driver if this option is true
         * @type {boolean}
         */
        this.noCreate = typeof options.noCreate === 'boolean' ? options.noCreate === true : false;

        /**
         * If true then types in the module can be modified in the runtime
         * @type {boolean}
         */
        this.noSeal = typeof options.noSeal === 'boolean' ? options.noSeal === true : false;

        /**
         * A callback that executes when a pipeline stage completes
         * @type {function(string,number): void}
         */
        this.onCompilerStageExecuted = typeof options.onCompilerStageExecuted === 'function' && options.onCompilerStageExecuted || function (msg, lvl) { };

        /**
         * A callback that executes when the compiler outputs some text.
         * @type {function(string,number): void}
         */
        this.onDebugOutput = typeof options.onDebugOutput === 'function' && options.onDebugOutput || function (msg, lvl) { };

        /**
         * A callback that executes when the compiler constructs an object instance.
         * @type {function(string,number): void}
         */
        this.onInstanceCreated = typeof options.onInstanceCreated === 'function' && options.onInstanceCreated || function (inst) { };

        /**
         * A callback that executes when the compiler completes.
         * @type {function}
         */
        this.onPipelineComplete = typeof options.onPipelineComplete === 'function' && options.onPipelineComplete || function () { };

        /**
         * A callback that executes when the compiler completes.
         * @type {function(string,number,number)}
         */
        this.onPipelineStage = typeof options.onPipelineStage === 'function' && options.onPipelineStage || function () { };

        /**
         * This is the relative path (if supplied) used when resolving imports expressed as relative paths
         * @type {string}
         */
        this.relativePath = typeof options.relativePath === 'string' && options.relativePath;

        /**
         * Is this a reload request?
         * @type {boolean}
         */
        this.reload = options.reload === true;

        /**
         * Should we re-compile all dependent modules?
         * @type {boolean}
         */
        this.reloadDependents = typeof options.reloadDependents === 'boolean' ? options.reloadDependents === true : false;

        /**
         * Should we require all class members to explicitly state their access modifier?
         * @type {boolean}
         */
        this.requireExplicitAccessModifiers = typeof options.requireExplicitAccessModifiers === 'boolean' ? options.requireExplicitAccessModifiers === true : false;

        /**
         * We are compiling/evaluating a block of code
         * @type {string}
         */
        this.source = typeof options.source === 'string' && options.source;

        for (const [key, val] of Object.entries(options)) {
            if (key in this === false) {
                console.log(`Warning: Unrecognized compiler option: ${key} = ${val}`);
            }
        }
    }

    /**
     * Create a child compiler option based on existing settings
     * @param {string} filename The target module path for the new settings
     * @returns {MUDCompilerOptions}
     */
    createChildOptions(filename) {
        let clone = new MUDCompilerOptions(Object.assign({}, this, { filename, file: filename }));

        return clone;
    }

    /**
     * Exports the portion of the options used by the transpiler
     */
    get transpilerOptions() {
        return {
            allowAsyncConstructors: this.allowAsyncConstructors,
            allowConstructorKeyword: this.allowConstructorKeyword,
            allowJsx: this.allowJsx,
            allowLazyBindings: this.allowLazyBindings,
            allowLazyConstructors: this.allowLazyConstructors,
            allowMultipleInheritance: this.allowMultipleInheritance,
            allowScopedIdentifiers: this.allowScopedIdentifiers,
            constructorName: this.constructorName,
            defaultMemberAccess: this.defaultMemberAccess,
            injectedSuperClass: this.injectedSuperClass,
            requireExplicitAccessModifiers: this.requireExplicitAccessModifiers,
            usingAltParent: !!this.altParent
        };
    }

    /**
     * Validate a potential constructor name
     * @param {string} name The proposed name to validate
     */
    static validateConstructorName(name) {
        if (name.length < 3)
            throw new Error(`Constructor name '${name}' is too short; Must be 3+ characters`);
        else if (/^\d+/.test(name))
            throw new Error(`Constructor name '${name}' is invalid; It may not start with a number`);
        else if (/^[a-zA-Z0-9\$\_]+$/.test(name))
            throw new Error(`Constructor name '${name}' is invalid; It contains prohibited characters`);
        else if (name === 'constructor')
            throw new Error(`Constructor name '${name}' is invalid; Constructor cannot actually be 'constructor'`);
        else
            return name;
    }
}

module.exports = MUDCompilerOptions;
