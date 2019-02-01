/*
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

Promise.prototype.always = function (onResolveOrReject) {
    return this.then(onResolveOrReject, reason => {
        onResolveOrReject(reason);
        throw reason;
    });
};

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
     * @param {MUDCompiler} compiler The compiler.
     */
    constructor(compiler) {
        let
            _contexts = MXC.initMap(),
            _loopCounter = loopsPerAssert;
        let self = this;

        this.console = console;

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
                    driver.cleanError(val, true);
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
                value: function (ob, method, fileName, classRef) {
                    let ctx = driver.getContext(),
                        mec = driver.getExecution(ob || false, method || '(undefined)', fileName, classRef),
                        now = new Date().getTime();
                    if (ctx) {
                        if (ctx.alarm && ctx.alarm < now)
                            throw createTimeoutError();
                        if (ob) {
                            ctx.addFrame(ob, method).increment();
                            return [ ctx.contextId, mec ];
                        }
                    }
                    else if (ob) {
                        ctx = driver.getContext(true, init => init.note = method)
                            .addFrame(ob, method);
                        ctx.restore();
                        return [ctx.contextId, mec];
                    }
                    return [false,mec];
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
                value: function (/** @type {number} */ contextId, /** @type {ExecutionContext} */ mec) {
                    try {
                        if (contextId > 0) {
                            let mxc = MXC.getById(contextId);
                            if (mxc) {
                                mxc.popStack();
                            }
                        }
                        mec && mec.pop();
                    }
                    catch (e) {
                        console.log(e);
                    }
                },
                enumerable: false,
                writable: false
            },
            __LINE__: {
                get: function () {
                    let foo = new Error('').stack.split('\n'), re = /((\d+):(\d+))/;
                    for (let i = 0, m = null, c = 0; i < foo.length; i++) {
                        if ((m = re.exec(foo[i])) && c++ === 1) return parseInt(m[1]);
                    }
                }
            },
            __pcc: {
                //  Prepare constructor call
                value: function (type, file, method, thisRef, con) {
                    let result = undefined, ecc = false,
                        fn = type.prototype && type.prototype.fileName;
                    try {
                        if (fn) {
                            let thisArg = thisRef && thisRef instanceof MUDObject && thisRef;
                                module = driver.cache.get(fn);
                            if (module) {
                                ecc = driver.getExecution(thisArg, method, file, false);
                                ecc.newContext = module.getNewContext(type);
                            }
                        }
                        result = con();
                    }
                    catch (err) {
                        throw err;
                    }
                    finally {
                        ecc && ecc.pop();
                    }
                    return result;
                },
                writable: false,
                enumerable: false
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
            Buffer: {
                value: global.Buffer,
                writable: false
            },
            eval: {
                value: function (code) {
                    let source = compiler.preprocess(code),
                        maxEvalTime = driver.config.driver.maxEvalTime || 10000;
                    return vm.runInContext(source, self, {
                        filename: 'eval',
                        displayErrors: true,
                        timeout: maxEvalTime
                    });
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
            mud_name: {
                value: function () {
                    return driver.config.mud.name;
                },
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
            MUDMixin: {
                value: global.MUDMixin,
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
            setTimeout: {
                value: global.setTimeout,
                writable: false
            }
        });
    }

    createEfuns() {
        let ctx = driver.getContext(), fn = ctx.currentFileName;
        return driver.createEfunInstance(fn);
    }

    createElement() {
        let children = [].slice.call(arguments),
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
    }

    prompt(optsIn, callback) {
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

    thisPlayer(flag) {
        return flag ? driver.currentContext.truePlayer : driver.currentContext.thisPlayer;
    }

    unwrap(target, success, hasDefault) {
        let result = false, defaultValue = hasDefault || false,
            onSuccess = typeof success === 'function' && success || function (s) {
                return s;
            };
        if (typeof target === 'function' && target._isWrapper === true) {
            result = target();
            if (!(result instanceof MUDObject)) result = defaultValue;
        }
        else if (typeof target === 'object' && target instanceof MUDObject) {
            result = target;
        }
        return result && onSuccess(result);
    }

    wrapper(target) {
        if (typeof target === 'function' && target._isWrapper === true)
            return target;
        else if (typeof target === 'object' && typeof target.wrapper === 'function')
            return target.wrapper;
        else if (target instanceof MUDObject) {
            throw new Error('wrapper() failed');
        }
        return false;
    }

    write(str) {
        let mxc = driver.getContext();
        if (mxc && mxc.client) {
            mxc.client.writeLine(str);
        }
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
