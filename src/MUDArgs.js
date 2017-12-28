
class MUDArgs {
    constructor(args) {
        /** @type {any[]} */
        this.args = [].slice.call(args);

        /** @type {number} */
        this.max = this.args.length;

        /** @type {number} */
        this.pos = 0;
    }

    /**
     * @type {number}
     */
    get length() {
        return this.max;
    }

    /**
     * Checks to see if the next argument is of the specified type.
     * @param {string} typeName
     * @returns {boolean}
     */
    nextIs(typeName) {
        return typeof this.args[this.pos] === typeName;
    }

    /**
     * 
     * @param {string} typeName
     * @param {any} defaultValue
     * @return {any} 
     */
    optional(typeName, defaultValue, transform) {
        let result = defaultValue || undefined;
        if (typeof defaultValue === 'function') {
            transform = defaultValue;
            result  = defaultValue = undefined;
        }
        if (this.pos < this.max) {
            if (typeof this.args[this.pos] === typeName) {
                result = this.args[this.pos++];
            }
        }
        if (typeof result !== 'undefined')
            return transform ? transform.call(this, result) : result;
    }

    required(typeName, defaultValue, transform) {
        let result = defaultValue || undefined;
        if (typeof defaultValue === 'function') {
            transform = defaultValue;
            result = defaultValue = undefined;
        }
        if (this.pos < this.max) {
            if (typeof this.args[this.pos] === typeName) {
                result = this.args[this.pos++];
            }
            throw new Error(`Bad argument #${this.pos}; Expected ${typeName} got ${(typeof this.args[this.pos])}`);
        }
        if (typeof result === 'undefined')
            throw new Error(`Missing argument #${this.pos}; Expected ${typeName} got undefined.`);
        return transform ? transform.call(this, result) : result;
    }
}

global.MUDArgs = MUDArgs;
module.exports = MUDArgs;
