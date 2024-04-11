/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 19, 2019
 *
 * Description: Provides stream support for server side client I/O.
 */
const
    ClientComponent = require('./ClientComponent'),
    { Writable, Readable, Duplex, Transform } = require('stream'),
    readline = require('readline'),
    uuidv1 = require('uuid/v1'),
    os = require('os');

const
    Buffers = {};

class InternalBuffer {
    constructor(component, shell, encoding='utf8') {
        this.buffer = '';
        this.component = component;
        this.encoding = encoding;
        this.id = uuidv1();
        this.shell = shell;
        Buffers[this.id] = this;
    }

    /**
     * Assign new stream ownership
     * @param {any} component
     * @param {any} shell
     */
    attach(component, shell) {
        this.component = component;
        this.shell = shell;
    }

    /**
     * Destroy the stream 
     */
    destroy() {
        this.buffer = this.shell = this.component = false;
        delete Buffers[this.id];
    }

    /**
     * Detach from the current owner
     */
    detach() {
        this.component = false;
        this.shell = false;
        return this;
    }

    /**
     * Write all content to the client 
     */
    flush() {
        let chunk = this.read(4096);
        if (chunk) {
            this.component.write(chunk);
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
        encoding = encoding || this.encoding || 'utf8';
        if (bufferOrString instanceof Buffer) {
            bufferOrString = bufferOrString.toString(this.encoding);
        }
        else if (encoding !== this.encoding) {
            bufferOrString = Buffer
                .from(bufferOrString, encoding)
                .toString(this.encoding);
        }
        this.buffer += bufferOrString;
    }
}

/**
 * Create a new internal buffer
 * @param {ClientComponent} component The component that owns this thing
 * @param {any} shell The shell tied to this stream.
 * @returns {InternalBuffer} The newly created internal buffer.
 */
InternalBuffer.create = function (component, shell, encoding = 'utf8') {
    return new InternalBuffer(component, shell, encoding);
};

/**
 * Attaches a new owner to a set of streams
 * @param {Object.<string,StandardInputStream|StandardOutputStream|StandardPassthruStream>} streams The streams to reconnect
 * @param {object} newOwner The new shell attached to this the streams.
 */
InternalBuffer.attach = function (streams, component, shell) {
    Object.keys(streams).forEach(name => {
        let stream = streams[name],
            buffer = InternalBuffer.get(stream.id);
        buffer.attach(component, shell);
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
     * @param {ClientComponent} component The component that is the source for this stream.
     * @param {CommandShell} shell The command shell to dispatch the input to.
     */
    constructor(opts, component, shell) {
        super(opts = Object.assign(
            {
                encoding: 'utf8'
            }, opts));
        let buffer = InternalBuffer.create(component, shell, opts.encoding);

        Object.defineProperty(this, 'id', {
            value: buffer.id,
            writable: false
        });
        
        component.on('data', buffer.onData = async (line) => {
            buffer.write(line);
            if (buffer.shell) {
                await buffer.shell.receiveInput(this);
            }
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
                buffer.component.off('data', buffer.listener);
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

class StandardBufferStream extends Transform {
    constructor() {
        super();
        this.buffer = Buffer.alloc(0);
    }

    end(...args) {
        return super.end(...args);
    }

    readAll(enc = 'utf8') {
        let result = this.buffer.toString(enc);
        this.buffer = Buffer.alloc(0);
        return result;
    }

    readLine(enc = 'utf8') {
        if (this.buffer.length === 0)
            return '';
        let n = this.buffer.findIndex(v => v === 10);

        if (n > -1) {
            let result = Uint8Array.prototype.slice.call(this.buffer, 0, n),
                len = this.buffer[n + 1] === 13 ? 2 : 1;
            this.buffer = Buffer.from(Uint8Array.prototype.slice.call(this.buffer, n + len));
            return result.toString(enc).trimEnd();
        }
        else {
            return this.readAll(enc).trimEnd();
        }
    }

    readLines(enc = 'utf8') {
        let results = [],
            line = this.readLine(enc);
        while (line) {
            results.push(line);
            line = this.readLine();
        }
        return results;
    }

    _transform(chunk, encoding, done) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        done();
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
    constructor(opts, component, shell) {
        super(opts = Object.assign(
            {
                encoding: 'utf8',
                decodeStrings: false,
                writableHighWaterMark: 32 * 1024
            }, opts));

        let buffer = InternalBuffer.create(component, shell, opts.encoding);

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
            content += os.EOL;
        return this.write(content, encoding);
    }
}

/**
 * Create a dummy stream that writes through to the client */
class StandardPassthruStream extends Writable {
    /**
     * @param {any} opts
     */
    constructor(opts, component, shell) {
        super(opts = Object.assign(
            {
                encoding: 'utf8',
                decodeStrings: false
            }, opts));

        let buffer = InternalBuffer.create(component, shell, opts.encoding);
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
            if (buffer && buffer.component) {
                if (buffer.component.writable) {
                    buffer.component.write(chunk);
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
    NullOutputStream,
    StandardBufferStream
};
