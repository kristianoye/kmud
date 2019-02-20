/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 19, 2019
 *
 * Description: Provides stream support for server side client I/O.
 */
const
    { Writable, Readable } = require('stream'),
    uuidv1 = require('uuid/v1');

const
    /** @type {Object.<string,string>} */
    Buffers = {};

/** @typedef {{ buffer: string|MUDClient, pos: number, length: number, encoding: string }} InternalBuffer */

/**
 * Returns a buffer by ID
 * @param {StandardInputStream|StandardOutputStream} o The stream to fetch a buffer for
 * @returns {InternalBuffer} The current buffer
 */
function $(o) { return Buffers[o.id]; }

/**
 * Creates a simple buffer and returns the new ID
 * @param {any} o
 * @param {any} buffer
 */
function $c(o, buffer = '', encoding = 'utf8') {
    let id = uuidv1();
    Buffers[id] = { buffer, length: buffer.length || -1, pos: 0, encoding };
    return id;
}

class StandardInputStream extends Readable {
    /**
     * Construct a new input stream
     * @param {ReadableOptions} opts Options passed to parent interface
     * @param {string} buffer The buffer available
     */
    constructor(opts, buffer) {
        super(opts = Object.assign(
            {
                encoding: 'utf8'
            }, opts));

        this.id = $c(this, buffer);
        Object.freeze(this);
    }

    get length() { return $(this).length; }

    _destroy(error, callback) {
        delete Buffers[this.id];
        super._destroy(error, callback);
    }

    /**
     * Read a set number of bytes from the stream.
     * @param {number} size The number of bytes to read.
     * @returns {}
     */
    _read(size) {
        let b = $(this), result = b.buffer.slice(b.pos, b.pos + size);
        if ((b.pos += size) > b.length) b.pos = b.length;
        return result;
    }

    /**
     * Peek at the next count of character(s)
     * @param {number} count The number of characters to try and read
     * @returns {string} The next N characters if available.
     */
    peek(count = 1) {
        let b = $(this); return b.buffer.slice(b.pos, b.pos + count);
    }

    /**
     * Read the next line from standard input
     */
    readLine() {
        let line = '', re = /\n/, b = $(this);
        for (; b.pos < b.len; b.pos++) {
            line += b.buffer.charAt(b.pos);
            if (efuns.text.trailingNewline(line)) break;
        }
        return line.trim();
    }
}

/**
 * Return the underlying content from the stream
 * @param {StandardInputStream|StandardOutputStream} o The stream to fetch
 */
StandardInputStream.get = function (o) {
    return $(o);
}

/**
 * Provides a writable stream that in-game methods can interact
 * with.  This content is then flushed once the command is completed
 **/
class StandardOutputStream extends Writable {
    constructor(opts) {
        super(opts = Object.assign(
            {
                encoding: 'utf8',
                decodeStrings: false,
                writableHighWaterMark: 32 * 1024
            }, opts));

        this.id = $c(this, '', opts.encoding);
        Object.freeze(this);
    }

    _destroy(error, callback) {
        delete Buffers[this.id];
        return super._destroy(error, callback);
    }

    /** @param {string|Buffer} chunk */
    /** @param {string} encoding */
    /** @param {function(Error):void} callback */
    _write(chunk, encoding = false, callback = false) {
        try {
            if (encoding && encoding !== this.encoding) {
                let buffer = new Buffer(chunk, encoding);
                chunk = buffer.toString(this.encoding);
            }
            $(this).buffer += chunk;
            $(this).length += chunk.length;
            callback && callback();
        }
        catch (err) {
            callback && callback(err);
        }
    }

    /** @param {{ chunk: string, encoding: string }[]} chunks */
    /** @param {function(Error):void} callback */
    _writev(chunks, callback) {
        try {
            chunks.forEach(c => {
                this._write(c.chunk, c.encoding);
            });
            callback && callback();
        }
        catch (err) {
            callback && callback(err);
        }
    }

    writeLine(content, encoding = false) {
        if (!efuns.text.trailingNewline(content))
            content += '\n';
        return this._write(content, encoding);
    }
}

/**
 * Create a dummy stream that writes through to the client */
class StandardPassthruStream extends Writable {
    /**
     * @param {any} opts
     * @param {MUDClient} client THe client
     */
    constructor(opts, client) {
        super(opts = Object.assign(
            {
                encoding: 'utf8',
                decodeStrings: false
            }, opts));

        this.id = $c(this, client, opts.encoding);
        Object.freeze(this);
    }

    _destroy(error, callback) {
        delete Buffers[this.id];
        return super._destroy(error, callback);
    }

    /** @param {string|Buffer} chunk */
    /** @param {string} encoding */
    /** @param {function(Error):void} callback */
    _write(chunk, encoding = false, callback = false) {
        if (chunk instanceof Buffer) {
            chunk = chunk.toString(encoding || $(this).encoding);
        }
        $(this).buffer.write(chunk);
    }

    /** @param {{ chunk: string, encoding: string }[]} chunks */
    /** @param {function(Error):void} callback */
    _writev(chunks, callback) {
        try {
            chunks.forEach(c => {
                this._write(c.chunk, c.encoding);
            });
            callback && callback();
        }
        catch (err) {
            callback && callback(err);
        }
    }

    writeLine(content, encoding = false) {
        if (!efuns.text.trailingNewline(content))
            content += '\n';
        return this._write(content, encoding);
    }
}

/**
 * Return the underlying content from the stream
 * @param {StandardInputStream|StandardOutputStream} o The stream to fetch
 */
StandardOutputStream.get = function (o) {
    return $(o);
}

module.exports = { StandardInputStream, StandardOutputStream, StandardPassthruStream };
