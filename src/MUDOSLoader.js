/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const { NotImplementedError } = require('./ErrorTypes');
const { ExecutionContext } = require('./ExecutionContext');
const MUDLoader = require('./MUDLoader');
const MUDObject = require('./MUDObject');
const SimpleObject = require('./SimpleObject');

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
                get: function (target) {
                    return efuns.adminp(target);
                }
            },
            archp: {
                value: function (target) { return _efuns.archp(target); }
            },
            enable_commands: {
                value: function (flag) {
                    var to = T.thisObject();
                },
                writable: false
            },
            environment: {
                value: function (arg) {
                    let ob = arg || T.thisObject();
                    return typeof ob === 'object' && ob.environment;
                },
                writable: false
            },
            read_buffer: {
                value: function (src, start, end) {
                    start = typeof start === 'number' ? start : false;
                    end = typeof end === 'number' ? end : false;

                    if (typeof src === 'string') {
                        src = Buffer.from(_efuns.readFileSync(src), 'utf8');
                    }
                    if (Buffer.isBuffer(src)) {
                        if (start !== false) {
                            return end !== false ? src.slice(start, end) : src.slice(start);
                        }
                        return src;
                    }
                    else throw new Error(`Bad argument 1 to read_buffer(); Expected string or buffer but got ${typeof src}`);
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

    //#region Array Efuns

    //
    //  Source: https://www.fluffos.info/efun/#gsc.tab=0
    //

    allocate(n, value = 0) {
        let result = new Array(size)
            .fill(typeof value === 'function' ? 0 : value);

        if (typeof value === 'function') {
            result = result.map((v, i) => value(i));
        }

        return result;
    }

    /**
     * Reference: https://www.fluffos.info/efun/arrays/arrayp.html#gsc.tab=0 
     * @param {any} target
     * @returns
     */
    arrayp(target) {
        return Array.isArray(target);
    }

    /**
     * Reference: https://www.fluffos.info/efun/arrays/element_of.html#gsc.tab=0
     * Returns a random element from an array
     * @param {any[]} arr
     */
    element_of(arr) {
        if (Array.isArray(arr)) {
            if (arr.length === 0)
                return undefined;
            else if (arr.length === 1)
                return arr[0];
            else {
                let index = efuns.random(0, arr.length);
                return arr[index];
            }
        }
    }

    /**
     * Reference: https://www.fluffos.info/efun/arrays/filter_array.html#gsc.tab=0
     * @param {any[]} arr
     * @param {function(...any):number | string} functionOrMethod
     * @param {MUDObject} [target] Optional target if func is a string
     * @param {...any} args
     * @returns {any[]}
     */
    filter_array(arr, functionOrMethod, target, ...args) {
        let filterCallback = func;

        if (!Array.isArray(arr))
            return 0;
        else if (arr.length === 0)
            return [];

        if (typeof functionOrMethod === 'string') {
            if (false === target instanceof MUDObject && false === target instanceof SimpleObject)
                throw `filter_array(): Filter method '${functionOrMethod}' must exist in a valid MUD object`;
            filterCallback = efuns.bindFunctionByName(target, functionOrMethod);
        }
        else if (typeof target !== 'undefined')
            args.unshift(target);

        return arr.filter(element => filterCallback(element, ...args) === 1);
    }

    /**
     * Reference: https://www.fluffos.info/efun/arrays/map_array.html#gsc.tab=0
     * @param {any[]} arr
     * @param {function(...any):number | string} functionOrMethod
     * @param {MUDObject} [target] Optional target if func is a string
     * @param {...any} args
     * @returns {any[]}
     */
    map_array(arr, functionOrMethod, target, ...args) {
        let mapperCallback = func;

        if (!Array.isArray(arr))
            return 0;
        else if (arr.length === 0)
            return [];

        if (typeof functionOrMethod === 'string') {
            if (false === target instanceof MUDObject && false === target instanceof SimpleObject)
                throw `filter_array(): Filter method '${functionOrMethod}' must exist in a valid MUD object`;
            filterCallback = efuns.bindFunctionByName(target, functionOrMethod);
        }
        else if (typeof target !== 'undefined')
            args.unshift(target);

        return arr.map(element => mapperCallback(element, ...args));
    }

    /**
     * Reference: https://www.fluffos.info/efun/arrays/member_array.html#gsc.tab=0
     * @param {any} item
     * @param {any[] | string} arr
     * @param {any} start
     */
    member_array(item, arr, start = 0) {
        if (typeof arr === 'string') {
            if (typeof item === 'number')
                item = String.fromCharCode(item);
            else if (typeof item === 'string' && item.length === 1)
                item = item.charAt(0);
            else
                throw `member_array(): First parameter must be a number or single character, not ${item}`;

            return arr.indexOf(item, start);
        }
        else if (Array.isArray(arr)) {
            return arr.findIndex((val, index) => {
                //  Pure lazy right here
                if (index < start)
                    return false;
                else
                    return (val === item);
            });
        }
    }

    /**
     * Reference: https://www.fluffos.info/efun/arrays/pointerp.html#gsc.tab=0
     * @param {any} arr
     * @returns
     */
    pointerp(arr) {
        return Array.isArray(arr);
    }

    /**
     * Reference: https://www.fluffos.info/efun/arrays/shuffle.html#gsc.tab=0
     * @param {any[]} arr
     */
    shuffle(arr) {
        if (Array.isArray(arr)) {
            for (let i = arr.length - 1; i > 0; i--) {
                let j = Math.floor(Math.random() * i),
                    tmp = arr[i];

                arr[i] = arr[j];
                arr[j] = tmp;
            }
        }
    }

    /**
     * Reference: https://www.fluffos.info/efun/general/sizeof.html
     * @param {any} arg
     * @returns
     */
    sizeof(arg) {
        if (Array.isArray(arg))
            return arg.length;
        else if (typeof arg === 'string')
            return arg.length;
        else if (typeof arg === 'object')
            return Object.getOwnPropertyNames(arg).length;
        else if (arg instanceof Buffer)
            return arg.byteLength;
        else
            return 0;
    }

    /**
     * Reference: https://www.fluffos.info/efun/arrays/sort_array.html#gsc.tab=0
     * @returns
     */
    sort_array() {
        var args = [].slice.call(arguments),
            arr = args.shift(),
            filter = args.shift();

        if (typeof filter === 'string') {
            var ob = args.shift();
            if (typeof ob !== 'object')
                throw new Error(`Bad argument 3 to sort_array(); Expected object got ${typeof ob}`);
            if (!(ob instanceof MUDObject || ob instanceof SimpleObject))
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
                if (Array.isArray(a) && Array.isArray(b)) {
                    return filter > -1 ?
                        (a[0] < b[0] ? -1 : (a[0] === b[0] ? 0 : 1)) :
                        (a[0] < b[0] ? 1 : (a[0] === b[0] ? 0 : -1));
                }
                else {
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

    /**
     * Reference: https://www.fluffos.info/efun/arrays/unique_array.html#gsc.tab=0
     * @returns
     */
    unique_array() {
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
            arr = arr.filter(o => o instanceof MUDObject || o instanceof SimpleObject);
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

    //#endregion

    //#region Buffer Efuns

    /**
     * Reference: https://www.fluffos.info/efun/buffers/allocate_buffer.html#gsc.tab=0
     * @param {any} n
     * @returns
     */
    allocate_buffer(n) {
        if (typeof n !== 'number')
            throw new Error(`Bad argument 1 to allocate_buffer; Expected number but got ${typeof n}`);
        var buff = Buffer.alloc(n);
        for (var i = 0; i < buff.length; i++) buff[i] = 0;
        return buff;
    }

    /**
     * Refence: https://www.fluffos.info/efun/buffers/bufferp.html#gsc.tab=0
     * @param {any} arg
     * @returns
     */
    bufferp(arg) {
        return arg instanceof Buffer;
    }

    /**
     * Reference: https://www.fluffos.info/efun/buffers/buffer_transcode.html#gsc.tab=0
     * @param {Buffer} src
     */
    buffer_transcode(src) {
        throw new NotImplementedError(`Method bufer_transcode() has not been implemented`);
    }

    //#endregion

    //#region Call Efuns

    /**
     * Reference: https://www.fluffos.info/efun/calls/call_other.html#gsc.tab=0
     * @param {any} target
     * @param {any} args
     * @returns
     */
    call_other(target, args) {
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

    /**
     * Reference: https://www.fluffos.info/efun/calls/call_out.html#gsc.tab=0
     * @param {...any} args
     * @returns
     */
    call_out(...args) {
        return super.setTimeout(...args);
    }

    /**
     * Reference: https://www.fluffos.info/efun/calls/call_stack.html#gsc.tab=0
     * @param {any} n
     */
    call_stack(n = 0) {
        let ecc = ExecutionContext.getCurrentExecution();

        if (typeof n !== 'number')
            throw '*Bad argument 1 to efun call_stack()';

        switch (n) {
            case 0:
                return ecc.stack.map(frame => frame.file || '/<driver>');

            case 1:
                return ecc.stack
                    .map(frame => frame.object)
                    .filter(o => o instanceof MUDObject || o instanceof SimpleObject)
                    .slice(0);

            case 2:
                return ecc.stack
                    .map(frame => frame.method)
                    .filter(m => typeof m === 'string' && m.length > 0)
                    .slice(0);

            case 3:
                return ecc.stack
                    .map(frame => frame.origin)
                    .filter(m => typeof m === 'string' && m.length > 0)
                    .slice(0);

            default:
                throw '*First argument of call_stack() must be 0, 1, 2, or 3';
        }
        return result;
    }

    /**
     * Reference: https://www.fluffos.info/efun/calls/origin.html#gsc.tab=0
     * TODO: Need to implement ExecutionFrame.origin
     */
    origin() {
        return super.origin();
    }

    /**
     * Reference: https://www.fluffos.info/efun/calls/previous_object.html#gsc.tab=0
     * @param {any} n
     */
    previous_object(n = undefined) {
        return efuns.previousObject(n);
    }

    /**
     * Reference: https://www.fluffos.info/efun/calls/this_object.html#gsc.tab=0
     * @returns
     */
    this_object() {
        return efuns.thisObject();
    }

    //#endregion

    //#region Contrib Efuns

    /**
     * Reference: https://www.fluffos.info/efun/contrib/assemble_class.html#gsc.tab=0
     * @param {any} arr
     */
    assemble_class(arr) {
        throw new NotImplementedError('assemble_class(): Tell me how this method is useful and I might imlement it');
    }

    /**
     * Reference: https://www.fluffos.info/efun/contrib/disassemble_class.html#gsc.tab=0
     * @param {any} ob
     * @returns
     */
    disassemble_class(ob) {
        if (ob instanceof MUDObject || ob instanceof SimpleObject)
            return Object.values(ob);
        else
            return [];
    }

    //#endregion

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

    load_object() { return efuns.loadObject.apply(efuns, arguments); }

    pointerp(arg) { return Array.isArray(arg); }

    query_privs(target = false) {
        return driver.efuns.objects.getGroups(target);
    }

    this_player(flag = undefined) {
        return efuns.thisPlayer(flag);
    }

    throw(msg) {
        throw new Error(msg);
    }

    write_buffer(dest, start, source) {
        throw new Error('Not implemented yet');
    }
}

module.exports = MUDOSLoader;
