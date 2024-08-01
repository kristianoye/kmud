/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const { ExecutionContext } = require('../ExecutionContext');
const
    { PipelineContext } = require('./PipelineContext'),
    VMAbstraction = require('./VMAbstraction'),
    MUDModule = require('../MUDModule'),
    path = require('path'),
    fs = require('fs'),
    vm = require('vm');

var
    CompilerTimeout = 0,
    ExtensionText = '';

class VMWrapper extends VMAbstraction {
    constructor() {
        super();
        this.initialized = false;
    }

    /**
     * 
     * @param {Promise} promise
     */
    makeQuerablePromise(promise) {
        // Don't modify any promise that has been already modified.
        if (promise.isResolved) return promise;

        // Set initial state
        var isPending = true;
        var isRejected = false;
        var isFulfilled = false;

        // Observe the promise, saving the fulfillment in a closure scope.
        var result = promise.then(
            function (v) {
                isFulfilled = true;
                isPending = false;
                return v;
            },
            function (e) {
                isRejected = true;
                isPending = false;
                throw e;
            }
        );

        result.isFulfilled = function () { return isFulfilled; };
        result.isPending = function () { return isPending; };
        result.isRejected = function () { return isRejected; };
        return result;
    }

    /**
     * Load an object in its own virtual sandbox;
     * @param {ExecutionContext} ecc The execution context
     * @param {PipelineContext} context The compiler context.
     * @param {MUDModule} module The module being loaded.
     * @returns {any} Returns a value from the virtual machine.
     */
    async runAsync(ecc, context, module) {
        module.context = vm.createContext(module.loader);
        module.loader.ctx = module.context;

        let options = {
            filename: context.resolvedName.toLowerCase(),
            lineOffset: 0,
            produceCachedData: false,
            displayErrors: true
        };

        if (CompilerTimeout > 0) {
            options.timeout = CompilerTimeout;
        }

        let content = ['(async(__hid) => { ',
            `const [__DIR__, __FILE__] = ['${module.directory}', '${module.filename}'], `,
            '__filename = __FILE__, ',
            '__dirname = __DIR__, ',
            '[efuns, __mec] = __cef(__hid, __filename), ',
            'module = efuns, ',
            'requireAsync = async (s) => { return await efuns.requireAsync(s); }; ',
        context.content,
            ` })('${ecc.handleId}')`].join('');

        if (!this.initialized) {
            try {
                let content = module.context.constructor.getInitialization &&
                    module.context.constructor.getInitialization();

                content && vm.runInContext(content, module.context);

                this.initialized = module.context.initialized = true;

                let files = fs.readdirSync(path.join(__dirname, '..', 'extensions'));
                console.log('Loading script extensions...');
                files.forEach(file => {
                    try {
                        let fullPath = path.join(__dirname, '..', 'extensions', file);
                        console.log('\tLoading ' + fullPath);

                        let content = fs.readFileSync(fullPath);
                        vm.runInContext(content, module.context, {
                            filename: fullPath,
                            displayErrors: true
                        });
                    }
                    catch (err) {
                        console.log(`\t\t\tFailed to load extension: ${file}: ${err.message}`);
                    }
                });
            }
            catch (err) {
                console.log('Error in initialization');
            }
        }

        try {
            let result = this.makeQuerablePromise(vm.runInContext(content, module.context, options));
            if (result.isPending())
                return await result;
            return result;
        }
        catch (e) {
            console.log(`Error in runAsync(): ${e.message}`);
        }
        return undefined;
    }

    /**
     * Eval support
     * @param {string} content The code to execute
     * @param {MUDLoader} context The context in which to run the code
     * @param {any} optionsIn
     */
    async runCodeAsync(content, context, optionsIn) {
        try {
            let options = Object.assign({
                filename: context.resolvedName.toLowerCase(),
                lineOffset: 0,
                produceCachedData: false,
                displayErrors: true
            }, optionsIn);
            let result = this.makeQuerablePromise(vm.runInContext(content, context, options));
            if (result.isPending())
                return await result;
            return result;
        }
        catch (e) {
            console.log(`Error in runCodeAsync(): ${e.message}`);
        }
        return undefined;
    }
}

VMWrapper.configureForRuntime = function (driver) {
    ExtensionText = driver.config.stripBOM(fs.readFileSync('src/Extensions.js', 'utf8'));
    CompilerTimeout = driver.config.driver.compiler.maxCompileTime;
};

module.exports = VMWrapper;
