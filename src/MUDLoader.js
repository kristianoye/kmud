/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDObject = require('./MUDObject'),
    MUDHtml = require('./MUDHtml'),
    TimeoutError = require('./ErrorTypes').TimeoutError,
    MXC = require('./MXC'),
    vm = require('vm'),
    loopsPerAssert = 10000;

var _includeCache = [], _asyncContexts = {};

function createTimeoutError() {
    let error = new TimeoutError('Maximum execution time exceeded');
    Error.captureStackTrace(error, createTimeoutError);
    let stack = error.stack.split('\n');
    stack.splice(1, 1);
    error.stack = stack.join('\n');
    return error;
}

class MUDLoader {
    /**
     * @param {EFUNProxy} _efuns The efuns instance
     * @param {MUDCompiler} _compiler A reference to the compiler.
     * @param {string} _directory The directory the target module lives in.
     * @param {object} options Various options passed by the driver.
     * @param {MUDCompilerOptions} compilerOptions Options passed to the compiler.
     */
    constructor(_efuns, _compiler, _directory, options, compilerOptions) {
        let
            _allowProxy = true,
            _contexts = MXC.initMap(),
            _exports = {},
            _extending = false,
            _isSingleton = false,
            _loaderEnabled = false,
            _loopCounter = loopsPerAssert,
            _primaryExport = false,
            _oldEfuns = _efuns,
            _options = options || {};
        let self = this;

        this.console = console;

        function addExport(name, val) {
            if (typeof val === 'function' && val.toString().startsWith('class ')) {
                if (val.prototype instanceof MUDObject || compilerOptions.noParent || compilerOptions.altParent) {
                    if (_primaryExport)
                        throw 'The module already has a primary export!';
                    _primaryExport = val;
                    _exports[val.name] = val;
                    this[val.name] = val;
                }
                else {
                    let setOn = [ val ];
                    setOn.forEach(_ => {
                        Object.defineProperty(_, 'filename', {
                            value: _efuns.filename,
                            writable: false
                        });
                    });
                    _exports[val.name] = val;
                }
            }
            else if (typeof val === 'object' && val instanceof MUDObject) {
                this[val.constructor.name] = val.constructor;
                this.primaryExport = val;
                _isSingleton = true;
            }
            else {
                if (val && typeof val === 'function' && val.toString().startsWith('class')) {
                    val.prototype.filename = _efuns.filename;
                }
                _exports[name] = val;
            }
        }

        Object.defineProperties(this, {
            $: {
                value: function (file) {
                    return unwrap(_efuns.findObject(file));
                },
                writable: false
            },
            __act: {
                // Assert Catch Type
                value: function (val) {
                    driver.cleanError(val, _options.filterTraces || true);
                    // Catching timeout errors is not allowed
                    if (val instanceof TimeoutError) {
                        throw val;
                    }
                    driver.errorHandler(val, true);
                },
                enumerable: false,
                writable: false
            },
            __ala: {
                //  Assert Loop Alarm (ala)
                value: function () {
                    if (--_loopCounter === 0) {
                        let ctx = driver.getContext(),
                            now = new Date().getTime();
                        _loopCounter = loopsPerAssert;
                        if (ctx.alarm && ctx.alarm < now)
                            throw createTimeoutError();
                    }
                },
                enumerable: false,
                writable: false
            },
            __bfc: {
                //  Begin Function Call
                value: function (ob, method) {
                    let ctx = driver.getContext(),
                        now = new Date().getTime();
                    if (ctx) {
                        if (ctx.alarm && ctx.alarm < now)
                            throw createTimeoutError();
                        if (ob) {
                            ctx.addFrame(ob, method).increment();
                            return ctx.contextId;
                        }
                    }
                    else if (ob) {
                        ctx = driver.getContext(true, init => init.note = method)
                            .addFrame(ob, method);
                        ctx.restore();
                        return ctx.contextId;
                    }
                    return false;
                },
                enumerable: false,
                writable: false
            },
            __dac: {
                //  Decrement Async Context
                value: function (aid) {
                    let ctx = _asyncContexts[aid] || false;
                    if (ctx) {
                        ctx.popStack();
                        delete _contexts[aid];
                    }
                }
            },
            __efc: {
                // End Function Call
                value: function (/** @type {number} */ contextId) {
                    try {
                        if (contextId > 0) {
                            let mxc = MXC.getById(contextId);
                            if (mxc) {
                                mxc.popStack();
                            }
                        }
                    }
                    catch (e) {
                        console.log(e);
                    }
                },
                enumerable: false,
                writable: false
            },
            __dirname: {
                value: _directory,
                writable: false
            },
            __filename: {
                value: _efuns.filename,
                writable: false
            },
            __DIR__: {
                value: _directory.endsWith('/') ? _directory : _directory + '/',
                writable: false
            },
            __FILE__: {
                value: _efuns.filename,
                writable: false
            },
            __LINE__: {
                get: function () {
                    let foo = new Error('').stack.split('\n'), re = /((\d+):(\d+))/;
                    for (let i = 0, m=null, c=0; i < foo.length; i++) {
                        if ((m = re.exec(foo[i])) && c++ === 1) return parseInt(m[1]);
                    }
                }
            },
            __iac: {
                ///   Increment Async Context
                value: function (ob, aid) {
                    let ctx = driver.getContext(),
                        now = new Date().getTime();
                    if (ctx) {
                        if (ctx.alarm && ctx.alarm < now)
                            throw createTimeoutError();
                        if (ob) {
                            ctx.addFrame(ob, 'async').increment();
                            return ctx.contextId;
                        }
                    }
                    else if (ob) {
                        ctx = driver.getContext(true, init => init.note = method)
                            .addFrame(ob, 'async');
                        ctx.restore();
                        return ctx.contextId;
                    }
                    _asyncContexts[aid] = ctx;
                },
                enumerable: false,
                writable: false
            },
            allowProxy: {
                get: function () { return _allowProxy; },
                set: function (v) { _allowProxy = typeof v === 'boolean' ? v : true; }
            },
            PartialType: {
                get: function () { return _extending; }
            },
            Buffer: {
                value: global.Buffer,
                writable: false
            },
            createElement: {
                value: function () {
                    var children = [].slice.call(arguments),
                        type = children.shift(),
                        props = children.shift();
                    if (typeof type === 'string') {
                        return new MUDHtml.MUDHtmlElement(type, props, children);
                    }
                    else if (typeof type === 'function' && type.toString().match(/^class /)) {
                        return new type(type, props, children);
                    }
                    else if (typeof type === 'function') {
                        return new MUDHtml.MUDHtmlComponent(type, props, children);
                    }
                },
                writable: false
            },
            export: {
                value: function (...list) {
                    list.forEach(val => {
                        if (typeof val === 'object') {
                            Object.keys(val).forEach(k => addExport.call(self, k, val[k]));
                        }
                        else if (typeof val === 'function' && val.toString().startsWith('class ')) {
                            addExport.call(self, val.name, val);
                        }
                        else if (typeof val === 'object' && val instanceof MUDObject) {
                            addExport.call(self, val.constructor.name, val);
                        }
                        else throw new Error('Illegal module export');
                    });
                    return list[0] || false;
                }
            },
            exports: {
                get: function () { return _exports; },
                set: function (val) {
                    if (typeof val === 'object') {
                        Object.keys(val).forEach(k => addExport.call(this, k, val[k]));
                    }
                    else if (typeof val === 'function' && val.toString().startsWith('class ')) {
                        addExport.call(this, val.name, val);
                    }
                    else if (typeof val === 'object' && val instanceof MUDObject) {
                        addExport.call(this, val.constructor.name, val);
                    }
                    else throw new Error('Illegal module export');
                }
            },
            efuns: {
                value: _efuns,
                writable: false
            },
            eval: {
                value: function (code) {
                    let source = _compiler.preprocess(code),
                        maxEvalTime = driver.config.driver.maxEvalTime || 10000;
                    return vm.runInContext(source, self, { filename: 'eval', displayErrors: true, timeout: maxEvalTime });
                },
                writable: false
            },
            directory: {
                value: _efuns.directory,
                writable: false
            },
            filename: {
                value: _efuns.filename,
                writable: false
            },
            getType: {
                value: function (typeName) {
                    return _exports[typeName] || false;
                },
                writable: false
            },
            require: {
                value: function (exp) {
                    if (typeof exp === 'string') {
                        switch (exp) {
                            case 'async':
                                return self[exp] = require('async');
                                
                            case 'crypto':
                                return self[exp] = require('crypto');

                            case 'lpc':
                                return self[exp] = require('./LPCCompat');

                            case 'net':
                                return self[exp] = require(exp);

                            default:
                                var filename = self.efuns.resolvePath(exp, self.efuns.directory),
                                    module = driver.compiler.compileObject({ file: filename });
                                if (!module)
                                    throw new Error('Failed to load parent module: ' + filename);
                                return module.importScope(self);
                        }
                    }
                    return this;
                },
                writable: false
            },
            imports: {
                value: function (src) {
                    var _ = this || self;
                    [].slice.call(arguments).forEach(exp => {
                        if (exp.indexOf('/') === -1) {
                            if (driver.validRequire(_efuns, exp)) {
                                _[exp] = require(exp) || false;
                                if (_[exp]) {
                                    throw new Error(`Required library ${expr} not found`);
                                }
                            }
                            else {
                                throw new Error(`Could not import module ${expr}: Permission denied`);
                            }
                        }
                        if (typeof exp === 'string') {
                            //  TODO: Add valid_external apply to let master decide which objects can use external node modules.
                            switch (exp) {
                                case 'lpc':
                                    _[exp] = require('./LPCCompat');
                                    break;

                                case 'async':
                                case 'net':

                                    _[exp] = require(exp);
                                    break;

                                default:
                                    var filename = _.efuns.resolvePath(src, _.efuns.directory),
                                        module = driver.compiler.compileObject({ file: src, reload: false, relativePath: _efuns.directory });
                                    if (!module)
                                        throw new Error('Failed to load parent module: ' + filename);
                                    module.importScope(_);
                                    break;
                            }
                        }
                    });
                    return this;
                },
                writable: false
            },
            include: {
                value: function (src) {
                    [].slice.call(arguments).forEach(fn => {
                        let searchPath = self.efuns.includePath(fn);

                        for (let i = 0, max = searchPath.length; i < max; i++) {
                            if (self.efuns.isFile(searchPath[i])) {
                                let content = self.efuns.readFile(searchPath[i]);
                                if (content) {
                                    let result = vm.runInContext(content, self, {
                                        filename: searchPath[i],
                                        lineOffset: 0,
                                        displayErrors: true
                                    });
                                    return true;
                                }
                            }
                        }
                        throw new Error('Failed to locate include file: ' + fn);
                    });
                    return this;
                },
                writable: false
            },
            isSingleton: {
                value: function (v) {
                    if (typeof v !== 'undefined') {
                        if (typeof v === 'boolean')
                            _isSingleton = v;
                        else throw new Error('isSingleton must be a boolean value not ' + typeof v);
                    }
                    return _isSingleton;
                },
                writable: false
            },
            loadPartial: {
                value: function (target,/** @type {string} */ src) {
                    var _ = this || self,
                        file = _efuns.resolvePath(src, _.directory),
                        content = _efuns.stripBOM(_efuns.readFile(file = file + (file.endsWith('.js') ? '' : '.js')));
                    try {
                        _extending = target;
                        var ctx = vm.createContext(_);
                        var result = vm.runInContext(content, ctx, {
                            filename: driver.fileManager.toRealPath(file),
                            lineOffset: 0,
                            displayErrors: true
                        });
                        _extending = false;
                    }
                    catch (_e) {
                        _extending = false;
                        throw _e;
                    }
                    return target;
                },
                writable: false
            },
            logger: {
                value: global.logger,
                writable: false
            },
            master: {
                value: function () {
                    return driver.masterObject;
                }
            },
            module: {
                get: function () { return this || self; }
            },
            mud_name: {
                value: function () {
                    return self.efuns.mudName();
                },
                writable: false
            },
            MUD: {
                value: this,
                writable: false
            },
            MUDEVENT_REMOVELISTENER: {
                value: global.MUDEVENT_REMOVELISTENER,
                writable: false
            },
            MUDEVENT_STOP: {
                value: global.MUDEVENT_STOP,
                writable: false
            },
            MUDHTMLComponent: {
                value: MUDHtml.MUDHTMLComponent,
                writable: false
            },
            MUDHtmlElement: {
                value: MUDHtml.MUDHtmlElement,
                writable: false
            },
            MUDObject: {
                value: MUDObject,
                writable: false
            },
            Object: {
                value: global.Object,
                writable: false
            },
            pluralize: {
                value: function (...args) {
                    return _efuns.pluralize(...args);
                },
                writable: false
            },
            primaryExport: {
                get: function () { return _primaryExport; },
                set: function (exp) {
                    if (!_primaryExport) {
                        _primaryExport = exp;
                        if (typeof exp === 'object')
                            _exports[exp.constructor.name] = exp;
                        else if (exp && exp.toString().startsWith('class ') && exp.prototype instanceof MUDObject)
                            _exports[exp.name] = exp;
                        else
                            throw new Error('Illegal primary export!');
                    }
                    else throw new Error('Module cannot export more than one MUDObject type!');
                }
            },
            prompt: {
                value: function (optsIn, callback) {
                    if (typeof optsIn === 'string') {
                        optsIn = { text: optsIn }; 
                    }
                    if (typeof callback !== 'function') {
                        throw new Error(`Bad argument 2 to prompt: Expected function but got ${typeof callback}`);
                    }
                    let opts = Object.assign({
                        default: false,
                        text: 'Prompt: ',
                        type: 'text'
                    }, optsIn), mxc = driver.getContext();
                    mxc.client && mxc.client.addPrompt(opts, callback);
                }
            },
            setTimeout: {
                value: global.setTimeout,
                writable: false
            },
            thisPlayer: {
                get: function (flag) {
                    return flag ? driver.currentContext.truePlayer : driver.currentContext.thisPlayer;
                }
            },
            unwrap: {
                get: function () { return unwrap; }
            },
            wrapper: {
                value: global.wrapper,
                writable: false
            },
            write: {
                value: function (str) {
                    let mxc = driver.getContext();
                    if (mxc && mxc.client) {
                        mxc.client.writeLine(str);
                    }
                },
                writable: false
            }
        });
    }
}

/**
 * Configure the loader for runtime.
 * @param {GameServer} driver A reference to the game driver.
 */
MUDLoader.configureForRuntime = function (driver) {
    mudglobal.modifyLoader(MUDLoader.prototype);
};

module.exports = MUDLoader;
