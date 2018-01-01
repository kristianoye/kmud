/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    net = require('net'),
    TOKEN_BEGINARRAY = 1,
    TOKEN_BEGINMAPPING = 2,
    TOKEN_ENDARRAY = 3,
    TOKEN_ENDMAPPING = 4,
    TOKEN_COMMA = 5,
    TOKEN_STRING = 6,
    TOKEN_ARRAY = 7,
    TOKEN_MAPPING = 8,
    TOKEN_COLON = 9,
    TOKEN_NUMBER = 10,
    TOKEN_DIGITS = [43, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 69, 101],
    TOKEN_NUMERICSTART = [43, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57],
    TOKEN_NUMERICUNIQUE = [43, 45, 69, 101];

class LPCParser {
    constructor() {  }

    deserialize(s, offset) {
        var n = offset || 0,
            l = s.length,
            stack = [],
            lvalue = [],
            token,
            cur;

        /**
         * Read the next token from the stream and update the position accordingly.
         * @returns {object} The next token (or throws an error)
         */
        function nextToken() {
            var sl, bs, d, v;

            if (s[n] === '(') {
                if (s[++n] === '[') return n++ , { id: TOKEN_BEGINMAPPING, pos: n };
                else if (s[n] === '{') return n++ , { id: TOKEN_BEGINARRAY, pos: n };
                else throw new Error('Unexpected character at %d', n);
            }
            else if (s[n] === '}') {
                if (s[++n] === ')') return n++ , { id: TOKEN_ENDARRAY, pos: n };
                else throw new Error('Unexpected character at %d', n);
            }
            else if (s[n] === ']') {
                if (s[++n] === ')') return n++ , { id: TOKEN_ENDMAPPING, pos: n };
                else throw new Error('Unexpected character at %d', n);
            }
            else if (s[n] === ',') {
                return n++ , { id: TOKEN_COMMA, pos: n };
            }
            else if (s[n] === '"') {
                bs = ++n, d = false, sl = 0;
                do {
                    if (n++ >= l) throw new Error('Unexepcted end of string starting at {0}'.fs(bs));
                    if (s[n] === '"') d = s[n - 1] !== '\\';
                    if (!d) sl++;
                }
                while (!d);
                return n++ , { id: TOKEN_STRING, value: s.substr(bs, sl + 1), pos: n };
            }
            else if (s[n] === ':') {
                return n++ , { id: TOKEN_COLON, pos: n };
            }
            else if (TOKEN_NUMERICSTART.indexOf(s.charCodeAt(n)) > -1) {
                bs = n, sl = 1, d = false;
                while (TOKEN_DIGITS.indexOf(s.charCodeAt(++n)) > 0) {
                    sl++;
                }
                var sv = s.substr(bs, sl);
                TOKEN_NUMERICUNIQUE.forEach(function (c, i) {
                    var cs = String.fromCharCode(c);
                    if (sv.indexOf(cs) !== sv.lastIndexOf(cs)) {
                        throw new Error('Invalid numeric expression starting at {0}'.fs(bs));
                    }
                });
                var nv = parseFloat(sv);
                return { id: TOKEN_NUMBER, value: nv, pos: n };
            }
            else if ((n + 1) < l)
                throw new Error('Unexpected character "{0}" at position {1}'.fs(s[n], n));
            return false;
        }
        while (token = nextToken()) {
            switch (token.id) {
                case TOKEN_BEGINARRAY:
                    stack.push(cur = []);
                    lvalue.push({ id: TOKEN_ARRAY, value: cur, pos: token.pos });
                    break;

                case TOKEN_BEGINMAPPING:
                    stack.push(cur = {});
                    lvalue.push({ id: TOKEN_MAPPING, value: cur, pos: token.pos });
                    break;

                case TOKEN_COLON:
                    lvalue.push(token);
                    break;

                case TOKEN_COMMA:
                    if (Array.isArray(cur)) {
                        if (lvalue.length > 0) {
                            var lv = lvalue.pop();
                            if ('value' in lv) cur.push(lv.value);
                            else throw new Error('Unexpected token at position {0}', fs(lv.pos));
                        }
                    }
                    else if (typeof cur === 'object') {
                        if (lvalue.length > 2) {
                            var val = lvalue.pop(), col = lvalue.pop(), key = lvalue.pop();
                            if ('value' in key && 'value' in val && col.id === TOKEN_COLON) {
                                cur[key.value] = val.value;
                            }
                            else if (lvalue.length > 0)
                                throw new Error('Unexpected mapping format near position {0}'.fs(lvalue[lvalue.length - 1].pos))
                        }
                    }
                    break;

                case TOKEN_ENDARRAY:
                    stack.pop();
                    if (stack.length > 0) cur = stack[stack.length - 1];
                    break;

                case TOKEN_ENDMAPPING:
                    stack.pop();
                    if (stack.length > 0) cur = stack[stack.length - 1];
                    break;

                case TOKEN_STRING:
                case TOKEN_NUMBER:
                    lvalue.push(token);
                    break;
            }
        }
        if (lvalue.length !== 1)
            throw new Error('Unexpected LPC result contained {0} element(s)'.fs(lvalue.length));
        var result = lvalue.pop();
        if ('value' in result)
            return result.value;
        else
            throw new Error('Result of LPC contained no data!');
    }

    /**
     * Serialize an object into an LPC-compatible string.
     * @param {any} o An expression to serialize.
     * @returns {string} The serialized object or false on failure.
     */
    serialize(o) {
        var result = false;

        if (typeof o === 'number') {
            if (parseInt(o) === o) {
                result = o.toString();
            }
            result = o.toString();
        }
        else if (typeof o === 'boolean') {
            result = o === true ? '1' : '0';
        }
        else if (typeof o === 'string') {
            result = '"' + o.replace(/"/g, '\"') + '"';
        }
        else if (typeof o === 'undefined') {
            result = "0";
        }
        else if (Array.isArray(o)) {
            var fun = Array.isArray(o);
            var foo = o.map((v, i) => { return this.serialize(v) });
            result = '({' + foo.join(',') + (foo.length > 0 ? ',' : '') + '})';
        }
        else if (typeof o === 'object') {
            var parts = [];
            for (var k in o) {
                parts.push(this.serialize(k) + ':' + this.serialize(o[k]));
            }

            result = '([' + parts.join(',') + (parts.length > 0 ? ',' : '') + '])';
        }
        return result;
    }

    int32ToByteArray(long) {
        var byteArray = new Uint8Array(4);

        for (var index = 0; index < byteArray.length; index++) {
            var byte = long & 0xff;
            byteArray[index] = byte;
            long = (long - byte) / 256;
        }
        return byteArray.reverse();
    }

    wireFormat(o) {
        var s = this.serialize(o),
            ecl = new Buffer(this.int32ToByteArray(s.length)),
            output = Buffer.concat([ecl, new Buffer(s, 'ascii')]);
        return output;
    }
}

class LPCServer extends net.Server {
    constructor() {
        super(...[].slice.call(arguments));
    }
}

class LPCSocket extends net.Socket {
    constructor() {
        super(...[].slice.call(arguments));
    }
}

module.exports = {
    LPCParser: LPCParser,
    LPCServer: LPCServer,
    LPCSocket: LPCSocket
}
