/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDData = require('./MUDData'),
    MUDObject = require('./MUDObject'),
    MUDHtml = require('./MUDHtml'),
    vm = require('vm'),
    sEfuns = Symbol('LoaderEfuns'),
    sArgs = Symbol('ConstructorArgs'),
    sLoaderEnabled = Symbol('LoaderEnabled');

var _includeCache = [];

class MUDLoader {
    /**
     * @param {EFUNProxy} _efuns The efuns instance
     */
    constructor(_efuns, _compiler, _directory) {
        var
            _allowProxy = true,
            _context = false,
            _exports = {},
            _extending = false,
            _isSingleton = false,
            _loaderEnabled = false,
            _primaryExport = false,
            _oldEfuns = _efuns,
            self = this;

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
                    _exports[val.name] = val;
                }
            }
            else if (typeof val === 'object' && val instanceof MUDObject) {
                this[val.constructor.name] = val.constructor;
                this.primaryExport = val;
                _isSingleton = true;
            }
            else
                _exports[name] = val;
        }

        Object.defineProperties(this, {
            $: {
                value: function (file) {
                    return unwrap(_efuns.findObject(file));
                },
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
                    var children = [].slice.apply(arguments),
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
                            console.log(x);
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
            require: {
                value: function (src) {
                    var _ = this || self;
                    [].slice.apply(arguments).forEach(exp => {
                        if (typeof exp === 'string') {
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
                                        module = MUDData.Compiler(filename);
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
            imports: {
                value: function (src) {
                    var _ = this || self;
                    [].slice.apply(arguments).forEach(exp => {
                        if (typeof exp === 'string') {
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
                                        module = MUDData.Compiler(filename);
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
                    var _ = this || self;
                    [].slice.apply(arguments).forEach(fn => {
                        var searchPath = _.efuns.includePath(fn);
                        var fullPath = _.efuns.resolvePath(fn, _.directory);

                        if (!fullPath.endsWith('.js'))
                            fullPath += '.js';

                        searchPath.unshift(fullPath);

                        for (var i = 0, max = searchPath.length; i < max; i++) {
                            var includedFile = searchPath[i];
                            if (_.efuns.isFile(includedFile)) {
                                var content = _includeCache[includedFile] || false;
                                try {
                                    if (!content) {
                                        content = MUDData.StripBOM(_.efuns.readFile(includedFile));
                                    }
                                    var ctx = vm.createContext(_);
                                    var result = vm.runInContext(content, ctx, {
                                        filename: MUDData.MudPathToRealPath(searchPath[i]),
                                        lineOffset: 0,
                                        displayErrors: true
                                    });
                                }
                                catch (x) {
                                    console.log(x);
                                }
                                return;
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
                value: function (target, src) {
                    var _ = this || self,
                        file = _.efuns.resolvePath(src, _.directory),
                        content = MUDData.StripBOM(_.efuns.readFile(file = file + (file.endsWith('.js') ? '' : '.js')));
                    try {
                        _extending = target;
                        var ctx = vm.createContext(_);
                        var result = vm.runInContext(content, ctx, {
                            filename: MUDData.MudPathToRealPath(file),
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
            master: {
                get: function () { return MUDData.InGameMaster; }
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
                value: function () {
                    return self.efuns.pluralize.apply(self.efuns, arguments);
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
            thisPlayer: {
                get: function () { return MUDData.ThisPlayer; }
            },
            unwrap: {
                get: function () { return unwrap; }
            },
            wrapper: {
                value: global.wrapper,
                writable: false
            }
        });
    }

    get loaderEnabled() {
        return this[sLoaderEnabled] || false;
    }

    createInstance(callback) {
        if (this[sLoaderEnabled]) {
            return callback.call(this, this[sEfuns], this[sArgs]);
        }
    }
}

module.exports = MUDLoader;
