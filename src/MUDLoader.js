/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDObject = require('./MUDObject'),
    MUDHtml = require('./MUDHtml'),
    vm = require('vm'),
    sEfuns = Symbol('LoaderEfuns'),
    sArgs = Symbol('ConstructorArgs'),
    sLoaderEnabled = Symbol('LoaderEnabled'),
    TimeoutError = require('./ErrorTypes').TimeoutError,
    loopsPerAssert = 10000;

var _includeCache = [];

class MUDLoader {
    /**
     * @param {EFUNProxy} _efuns The efuns instance
     * @param {MUDCompiler} _compiler A reference to the compiler.
     * @param {string} _directory The directory the target module lives in.
     */
    constructor(_efuns, _compiler, _directory) {
        var
            _allowProxy = true,
            _context = false,
            _exports = {},
            _extending = false,
            _isSingleton = false,
            _loaderEnabled = false,
            _loopCounter = loopsPerAssert,
            _primaryExport = false,
            _oldEfuns = _efuns;
        var
            self = (/** @returns {MUDLoader} @param {MUDObject} t */ function (t) {
                return t;
            })(this);

        this.console = console;

        function addExport(name, val) {
            if (typeof val === 'function' && val.toString().startsWith('class ')) {
                if (val.prototype instanceof MUDObject) {
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

        function createTimeoutError() {
            let error = new TimeoutError('Maximum execution time exceeded');
            Error.captureStackTrace(error, createTimeoutError);
            let stack = error.stack.split('\n');
            stack.splice(1, 1);
            error.stack = stack.join('\n');
            return error;
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
                    // Catching timeout errors is not allowed
                    if (val instanceof TimeoutError) {
                        throw val;
                    }
                },
                writable: false
            },
            __afa: {
                //  Assert Function Alarm
                value: function () {
                    let ctx = driver.getContext(),
                        now = new Date().getTime();
                    if (ctx.alarm && ctx.alarm < now)
                        throw createTimeoutError();
                },
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
            createInstance: {
                value: function (callback) {
                    if (_loaderEnabled) {
                        try {
                            return callback.call(this, _efuns, _context);
                        }
                        catch (x) {
                            logger.log(x);
                            throw x;
                        }
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
                            case 'crypto':
                                return self[exp] = require('crypto');

                            case 'lpc':
                                return self[exp] = require('./LPCCompat');

                            case 'net':
                                return self[exp] = require(exp);

                            default:
                                var filename = self.efuns.resolvePath(exp, self.efuns.directory),
                                    module = driver.compiler.compileObject(filename);
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
                                        module = driver.compiler.compileObject(src, false, _efuns.directory);
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
            setTimeout: {
                value: global.setTimeout,
                writable: false
            },
            String: {
                value: global.String
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
