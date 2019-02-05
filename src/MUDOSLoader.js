/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    MUDLoader = require('./MUDLoader');

class MUDOSLoader extends MUDLoader {
    /**
     * @param {MUDCompiler} compiler The compiler.
     */
    constructor(compiler) {
        super(compiler);
        var T = this;

        Object.defineProperties(this, {
            abs: {
                value: function (n) { return _efuns.abs(n); }
            },
            adminp: {
                value: function (target) { return _efuns.adminp(target); }
            },
            archp: {
                value: function (target) { return _efuns.archp(target); }
            },
            assemble_class: {
                value: function (arr) { return _efuns.assemble_class(arr);  }
            },
            call_other: {
                value: function (target, args) {
                    var _args = [].slice.call(arguments),
                        _target = _args.shift(),
                        _method = _args.shift();

                    if (Array.isArray(_target)) {
                        return _target.map(o => typeof o === 'string' ? unwrap(_efuns.loadObjectSync(o)) : unwrap(o))
                            .filter(o => o !== false)
                            .map(o => {
                                return o[_method].apply(o, _args);
                            });
                    }
                    else {
                        target = typeof _target === 'string' ? _efuns.loadObjectSync(_target) : unwrap(_target);
                        if (target === false)
                            throw new Error(`Bad argument 1 to call_other(); Expected array or MUD object got ${typeof target}`);
                        return target[_method].apply(target, _args);
                    }
                }
            },
            call_out: {
                value: function () {

                }
            },
            enable_commands: {
                value: function (flag) {
                    var to = _efuns.thisObject();
                },
                writable: false
            },
            previous_object: {
                value: function (n) {
                    return _efuns.previousObject(n);
                },
                writable: false
            },
            read_buffer: {
                value: function (src, start, end) {
                    start = typeof start === 'number' ? start : false;
                    end = typeof end === 'number' ? end : false;

                    if (typeof src === 'string') {
                        src = new Buffer(_efuns.readFileSync(src), 'utf8');
                    }
                    if (src instanceof Buffer) {
                        if (start !== false) {
                            return end !== false ? src.slice(start, end) : src.slice(start);
                        }
                        return src;
                    }
                    else throw new Error(`Bad argument 1 to read_buffer(); Expected string or buffer but got ${typeof src}`);
                }
            },
            this_object: {
                value: function () {
                    var module = driver.cache.get(T.efuns.filename);
                    return module.instances[0];
                }
            },
            unique_array: {
                value: function () {
                    var args = [].slice.call(arguments),
                        arr = args.shift(),
                        sep = args.shift(),
                        skip = args.shift() || false,
                        to = T.this_object();

                    if (skip !== false) {
                        if (typeof skip === 'function')
                            arr = arr.filter(o => !skip.call(this.this_object(), o));
                        else
                            arr = arr.filter(o => o !== skip);
                    }
                    if (sep === 'string') {
                        if (typeof to[sep] !== 'function')
                            throw new Error(`Object ${_efuns.filename} does not contain method ${sep}`);
                        arr = arr.filter(o => o instanceof MUDObject);
                        sep = (function (_to, _fn) {
                            return function (o) { return _to[_fn].call(_to, _fn, o); };
                        })(to, sep);
                    }
                    if (typeof sep === 'function') {
                        var result = {}, groups = [];
                        var list = arr.map(o => {
                            var groupId = sep.call(to, o);
                            if (typeof groupId !== 'string' || typeof groupId !== 'number') {
                                groupId = JSON.stringify(groupId);
                            }
                            if (!(groupId in result)) {
                                result[groupId] = [];
                                groups.push(groupId);
                            }
                            result[groupId].push(o);
                        });
                        return groups.sort((a, b) => a < b ? -1 : 1).map(a => result[a]);
                    }
                    else throw new Error(`Bad argument 2 to unique_array(); Expected string or function but got ${typeof sep}`);
                }
            },
            users: {
                value: function () { return _efuns.players(); }
            },
            wizardp: {
                value: function (target) { return _efuns.wizardp(target); }
            }
        });
    }

    allocate_buffer(n) {
        if (typeof n !== 'number')
            throw new Error(`Bad argument 1 to allocate_buffer; Expected number but got ${typeof n}`);
        var buff = new Buffer(n);
        for (var i = 0; i < buff.length; i++) buff[i] = 0;
        return buff;
    }

    arrayp(target) {
        return Array.isArray(target);
    }

    allocate(n) {
        return Array(n);
    }

    bufferp(arg) {
        return arg instanceof Buffer;
    }

    catch(expr) {
        var result = 0;
        try {
            result = eval(expr);
        } 
        catch (ex) {
            driver.cleanError(ex);
            result = '*' + ex.message + '\n' + ex.stack;
        }
        return result;
    }

    filter_array() {
        var args = [].slice.call(arguments),
            arr = args.shift(),
            filter = args.shift();

        if (typeof filter === 'string') {
            var ob = args.shift();
            if (typeof ob !== 'object')
                throw new Error(`Bad argument 3 to filter_array(); Expected object got ${typeof ob}`);
            if (!(ob instanceof MUDObject))
                throw new Error(`Bad argument 3 to filter_array(); ${ob.prototype.name} does not inherit MUDObject`);
            if (typeof ob[filter] !== 'function')
                throw new Error(`Bad argument 2 to filter_array(); ${ob.prototype.name} does not contain method ${filter}`);
            return arr.filter(a => {
                return ob[filter].call(ob, a, ...args);
            });
        }
        return arr.filter(a => {
            return filter.call(this, a, ...args);
        });
    }

    load_object() { return this.efuns.loadObject.apply(this.efuns, arguments); }

    member_array() {
        var args = [].slice.call(arguments),
            item = args.shift(),
            arr = args.shift(),
            startIndex = args.shift() || 0;

        var ret = arr.slice(startIndex).indexOf(item);
        return ret === -1 ? -1 : ret + startIndex;
    }

    message(messageType, msg, ...recipients) {
        return this.efuns.message(messageType, msg, ...recipients);
    }

    pointerp(arg) { return Array.isArray(arg); }

    sort_array() {
        var args = [].slice.call(arguments),
            arr = args.shift(),
            filter = args.shift();

        if (typeof filter === 'string') {
            var ob = args.shift();
            if (typeof ob !== 'object')
                throw new Error(`Bad argument 3 to sort_array(); Expected object got ${typeof ob}`);
            if (!(ob instanceof MUDObject))
                throw new Error(`Bad argument 3 to sort_array(); ${ob.prototype.name} does not inherit MUDObject`);
            if (typeof ob[filter] !== 'function')
                throw new Error(`Bad argument 2 to sort_array(); ${ob.prototype.name} does not contain method ${filter}`);

            return arr.sort((a, b) => {
                return ob[filter].call(ob, a, b, ...args);
            });
        }
        else if (typeof filter === 'function') {
            return arr.slice(0).sort((a, b) => {
                return filter.call(this, a, b, ...args);
            });
        }
        else if (typeof filter === 'number') {
            return arr.slice(0).sort((a, b) => {
                if (Array.isArray(a) && Array.isArray(b))
                {
                    return filter > -1 ?
                        (a[0] < b[0] ? -1 : (a[0] === b[0] ? 0 : 1)) :
                        (a[0] < b[0] ? 1 : (a[0] === b[0] ? 0 : -1));
                }
                else
                {
                    return filter > -1 ?
                        (a < b ? -1 : 1) :
                        (a < b ? 1 : -1);
                }
            });
        }
        else {
            throw new Error(`Bad argument 2 to sort_array(); Expected string, function, or number but got ${typeof filter}`);
        }
    }

    this_player(flag) { return flag ? driver.truePlayer : driver.thisPlayer; }

    throw(msg) {
        throw new Error(msg);
    }

    write_buffer(dest, start, source) {
        throw new Error('Not implemented yet');
    }
}

module.exports = MUDOSLoader;
