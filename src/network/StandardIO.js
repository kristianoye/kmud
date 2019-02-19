/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 19, 2019
 *
 * Description: Provides stream support for server side client I/O.
 */
const
    { Writable, Readable } = require('stream'),
    EOL = require('os').EOL;

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

        this.encoding = opts.encoding;
        this.buffer = buffer;
        this.pos = 0;
        this.len = buffer.length;
    }

    /**
     * Read a set number of bytes from the stream.
     * @param {number} size The number of bytes to read.
     * @returns {}
     */
    _read(size) {
        let result = this.buffer.slice(this.pos, this.pos + size);
        if ((this.pos += size) > this.len) this.pos = this.len;
        return result;
    }

    /**
     * Peek at the next count of character(s)
     * @param {number} count The number of characters to try and read
     * @returns {string} The next N characters if available.
     */
    peek(count = 1) {
        return this.buffer.slice(this.pos, this.pos + count);
    }

    /**
     * Read the next line from standard input
     */
    readLine() {
        let line = '', re = /\n/;
        for (; this.pos < this.len; this.pos++) {
            line += this.buffer.charAt(this.pos);
            if (re.test(c)) break;
            if (line.endsWith(EOL)) break;
        }
        return line.trim();
    }
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
                decodeStrings: true,
                writableHighWaterMark: 32 * 1024
            }, opts));
        this.buffer = '';
        this.encoding = opts.encoding;
        this.closed = false;
    }

    _destroy(error, callback) {
        this.buffer = null;
        return super._destroy(error, callback);
    }

    end(chunk, encoding, cb) {
        this.closed = true;
        return super.end(chunk, encoding, cb);
    }

    getBuffer(encoding = false) {
        if (!this.closed)
            throw new Error('The stream has not been finalized, yet!');
        return new Buffer(this.buffer, encoding || this.encoding);
    }

    getContent() {
        if (!this.closed)
            throw new Error('The stream has not been finalized, yet!');
        return this.buffer.toString(this.encoding);
    }

    /** @param {string|Buffer} chunk */
    /** @param {string} encoding */
    /** @param {function(Error):void} callback */
    _write(chunk, encoding = false, callback = false) {
        try {
            if (encoding && encoding !== this.encoding) {
                let buffer = new Buffer(chunk, encoding);
                this.buffer += buffer.toString(this.encoding);
            }
            else
                this.buffer += chunk;
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
        return this._write(content + '\n', encoding);
    }
}

module.exports = { StandardInputStream, StandardOutputStream };
