﻿/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 19, 2019
 *
 * Description: Provides stream support for server side client I/O.
 */
const
    { Writable, Readable } = require('stream'),
    uuidv1 = require('uuid/v1'),
    os = require('os');

const
    Buffers = {};

class InternalBuffer {
    constructor(client, shell, encoding='utf8') {
        this.buffer = '';
        this.client = client;
        this.encoding = encoding;
        this.id = uuidv1();
        this.shell = shell;
        Buffers[this.id] = this;
    }

    /**
     * Assign new stream ownership
     * @param {any} client
     * @param {any} shell
     */
    attach(client, shell) {
        this.client = client;
        this.shell = shell;
    }

    /**
     * Destroy the stream 
     */
    destroy() {
        this.buffer = this.shell = this.client = false;
        delete Buffers[this.id];
    }

    /**
     * Detach from the current owner
     */
    detach() {
        this.client = false;
        this.shell = false;
        return this;
    }

    /**
     * Write all content to the client 
     */
    flush() {
        let chunk = this.read(4096);
        if (chunk) {
            this.client.write(chunk);
            if (chunk.length === 4096) // there might be more
                setTimeout(() => this.flush(), 0);
        }
    }

    get length() {
        return this.buffer.length;
    }

    peek(count = 1) {
        return this.buffer.slice(0, count);
    }

    /**
     * Takes n number of characters out of the buffer.
     * @param {number} count The number of characters to read
     */
    read(count = 1) {
        let result = this.buffer.slice(0, count);
        this.buffer = this.buffer.slice(count);
        return result;
    }

    /**
     * Read an entire line from the buffer
     * @returns {string} Returns one or more characters or undefined if the buffer is empty.
     */
    readLine() {
        for (let i = 0, r = '', max = this.length; i < max; i++) {
            r += this.buffer.charAt(i);
            if (efuns.text.trailingNewline(r) || i + 1 === max) {
                this.buffer = this.buffer.slice(r.length);
                return r;
            }
        }
        return '';
    }

    /**
     * Write a block of content to the buffer
     * @param {Buffer|string} bufferOrString The content to write
     */
    write(bufferOrString, encoding = false) {
        encoding = encoding || this.encoding;
        if (bufferOrString instanceof Buffer) {
            bufferOrString = bufferOrString.toString(this.encoding);
        }
        else if (encoding !== this.encoding) {
            bufferOrString = new Buffer(bufferOrString, encoding).toString(this.encoding);
        }
        this.buffer += bufferOrString;
    }
}

/**
 * Create a new internal buffer
 * @param {MUDClient} client The client tied to this stream.
 * @param {any} shell The shell tied to this stream.
 * @returns {InternalBuffer} The newly created internal buffer.
 */
InternalBuffer.create = function (client, shell, encoding = 'utf8') {
    return new InternalBuffer(client, shell, encoding);
};

/**
 * Attaches a new owner to a set of streams
 * @param {Object.<string,StandardInputStream|StandardOutputStream|StandardPassthruStream>} streams The streams to reconnect
 * @param {object} newOwner The new shell attached to this the streams.
 */
InternalBuffer.attach = function (streams, client, shell) {
    Object.keys(streams).forEach(name => {
        let stream = streams[name],
            buffer = InternalBuffer.get(stream.id);
        buffer.attach(client, shell);
    });
};

/**
 * Detaches a buffer from its current owner and returns the 
 * public interface referecne (e.g. StandardOutputStream, etc)
 * @param {StandardInputStream|StandardOutputStream|StandardPassthruStream} stream
 */
InternalBuffer.detach = function (stream) {
    let buffer = InternalBuffer.get(stream.id);
    buffer.detach();
    return stream;
};

/**
 * Get an internal buffer object.
 * @param {string|StandardInputStream|StandardOutputStream} uuid The ID of the buffer to fetch.
 * @returns {InternalBuffer} The internal buffer if it has not been destroyed.
 */
InternalBuffer.get = function (uuid) {
    if (typeof uuid === 'object') {
        return InternalBuffer.get(uuid.id);
    }
    if (uuid in Buffers)
        return Buffers[uuid];
    throw new Error(`Stream ID ${uuid} has been destroyed!`);
}

class StandardInputStream extends Readable {
    /**
     * Construct a new input stream
     * @param {ReadableOptions} opts Options passed to parent interface
     * @param {string} buffer The buffer available
     */
    constructor(opts, client, shell) {
        super(opts = Object.assign(
            {
                encoding: 'utf8'
            }, opts));
        let buffer = InternalBuffer.create(client, shell, opts.encoding);

        Object.defineProperty(this, 'id', {
            value: buffer.id,
            writable: false
        });
        
        client.on('data', buffer.onData = (line) => {
            buffer.write(line);
            buffer.shell && buffer.shell.receiveInput(this);
        });
    }

    get length() {
        return InternalBuffer.get(this).length;
    }

    _destroy(error, callback) {
        let buffer = InternalBuffer.get(this);
        if (buffer) {
            // We need stdin to stop listening for data
            if (buffer.listener) 
                buffer.client.off('data', buffer.listener);
            buffer.destroy();
        }
        super._destroy(error, callback);
    }

    /**
     * Read a set number of bytes from the stream.
     * @param {number} count The number of bytes to read.
     * @returns {string} The chunk to read.
     */
    _read(count) {
        return InternalBuffer.get(this).read(count);
    }

    /**
     * Peek at the next count of character(s)
     * @param {number} count The number of characters to try and read
     * @returns {string} The next N characters if available.
     */
    peek(count = 1) {
        return InternalBuffer.get(this).peek(count);
    }

    /**
     * Read the next line from standard input
     */
    readLine() {
        return InternalBuffer.get(this).readLine();
    }
}

/**
 * Return the underlying content from the stream
 * @param {StandardInputStream|StandardOutputStream} o The stream to fetch
 */
StandardInputStream.get = function (o) {
    return InternalBuffer.get(o);
}

/**
 * Provides a writable stream that in-game methods can interact
 * with.  This content is then flushed once the command is completed
 **/
class StandardOutputStream extends Writable {
    constructor(opts, client, shell) {
        super(opts = Object.assign(
            {
                encoding: 'utf8',
                decodeStrings: false,
                writableHighWaterMark: 32 * 1024
            }, opts));

        let buffer = InternalBuffer.create(client, shell, opts.encoding);

        Object.defineProperty(this, 'id', {
            value: buffer.id,
            writable: false
        });
    }

    _destroy(error, callback) {
        InternalBuffer.get(this).destroy();
        return super._destroy(error, callback);
    }

    /** @param {string|Buffer} chunk */
    /** @param {string} encoding */
    /** @param {function(Error=false):void} callback */
    _write(chunk, encoding, callback) {
        try {
            let buffer = InternalBuffer.get(this);
            buffer.write(chunk, encoding);
            callback();
        }
        catch (err) {
            callback(err);
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

    flush() {
        return InternalBuffer.get(this).flush();
    }

    writeLine(content, encoding = false) {
        if (!efuns.text.trailingNewline(content))
            content += '\n';
        return this.write(content, encoding);
    }
}

/**
 * Create a dummy stream that writes through to the client */
class StandardPassthruStream extends Writable {
    /**
     * @param {any} opts
     */
    constructor(opts, client, shell) {
        super(opts = Object.assign(
            {
                encoding: 'utf8',
                decodeStrings: false
            }, opts));

        let buffer = InternalBuffer.create(client, shell, opts.encoding);
        Object.defineProperty(this, 'id', {
            value: buffer.id,
            writable: false
        });
    }

    _destroy(error, callback) {
        InternalBuffer.get(this).destroy();
        return super._destroy(error, callback);
    }

    /** @param {string|Buffer} chunk */
    /** @param {string} encoding */
    /** @param {function(Error):void} callback */
    _write(chunk, encoding, callback) {
        try {
            let buffer = InternalBuffer.get(this);

            if (chunk instanceof Buffer) {
                chunk = chunk.toString(encoding || buffer.encoding);
            }
            if (buffer && buffer.client) {
                if (buffer.client.writable) {
                    buffer.client.write(chunk);
                }
            }
            callback();
        }
        catch (err) {
            callback(err);
        }

    }

    /** @param {{ chunk: string, encoding: string }[]} chunks */
    /** @param {function(Error):void} callback */
    _writev(chunks, callback) {
        try {
            chunks.forEach(c => this._write(c.chunk, c.encoding));
            callback();
        }
        catch (err) {
            callback(err);
        }
    }

    writeLine(content, encoding = false) {
        if (!efuns.text.trailingNewline(content)) content += os.EOL;
        return this.write(content, encoding);
    }
}

/**
 * Return the underlying content from the stream
 * @param {StandardInputStream|StandardOutputStream} o The stream to fetch
 */
StandardOutputStream.get = function (o) {
    return InternalBuffer.get(o);
}

//  The /dev/null stream
const
    NullOutputStream = new StandardPassthruStream();

module.exports = {
    InternalBuffer,
    StandardInputStream,
    StandardOutputStream,
    StandardPassthruStream,
    NullOutputStream
};
