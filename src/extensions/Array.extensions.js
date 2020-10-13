/*
 * Extensions to the Array object
 * Lots of LINQ-like functionality
 */
const
    driverInstance = driver;

class NoElementError extends Error {
    constructor() {
        super('Sequence contains no elements');
    }
}

class AmbiguousElementError extends Error {
    constructor() {
        super('Sequence contains more than watching element');
    }
}

Array.prototype.any = function (test) {
    if (typeof test !== 'function') test = function (x) { return true; };
    for (let i = 0; i < this.length; i++) {
        if (test(this[i], i)) return true;
    }
    return false;
};

Array.prototype.count = function (test) {
    if (typeof test !== 'function')
        test = e => true;
    let matches = this.filter(test);
    return matches.length;
}

Array.prototype.defaultIfEmpty = function (val) {
    let result = this.slice(0);
    result.$default = val;
    return result;
};

Array.prototype.first = function (test) {
    if (typeof test !== 'function') test = function (x) { return true; };
    let results = this.filter(test);
    if (results.length === 0) throw new NoElementError();
    else return results[0];
}

Array.prototype.firstOrDefault = function (test) {
    if (typeof test !== 'function') test = function(x) { return true; };
    for (let i = 0; i < this.length; i++) {
        if (test(this[i], i)) return this[i];
    }
    return this.$default;
};

Array.prototype.forEachAsync = async function (callback, concurrent = 1) {
    if (/^async /.test(callback.toString()) === false)
        throw new Error('Callback must be async');
    for (let i = 0; i < this.length; i++) {
        await callback(this[i], i);
    }
    return this;
};
Array.prototype.last = function (test) {
    if (typeof test !== 'function')
        test = function (x) { return true; };
    for (let i = this.length - 1; i > -1; i--) {
        if (test(this[i], i)) return this[i];
    }
    throw new NoElementError();
};

Array.prototype.lastOrDefault = function (test) {
    if (typeof test !== 'function')
        test = function (x) { return true; };
    for (let i = this.length - 1; i > -1; i--) {
        if (test(this[i], i)) return this[i];
    }
    return this.$default;;
};

Array.prototype.mapAsync = async function (mapper) {
    let result = [];
    for (let i = this.firstIndex || 0, m = this.length; i < m; i++) {
        result[i] = await mapper(this[i], i);
    }
    return result;
};

Array.prototype.orderBy = function (orderBy = (val => val)) {
    let result = this.slice(this.firstIndex || 0);

    if (typeof orderBy !== 'function')
        orderBy = (a, b) => { return a < b ? -1 : (b > a ? 1 : 0); };

    result.sort((a, b) => {
        let $a = orderBy(a),
            $b = orderBy(b);
        if ($a < $b) return -1;
        else if ($b < $a) return 1;
        else return 0;
    });
    return result;
};

Array.prototype.orderByDescending = function (orderBy = (val => val)) {
    let result = this.slice(0);
    result.sort((a, b) => {
        let $a = orderBy(a),
            $b = orderBy(b);
        if ($a < $b) return 1;
        else if ($b < $a) return -1;
        else return 0;
    });
    return result;
};

Array.prototype.setMaxLength = function (count) {
    this.firstIndex = 0;
    if (this.length > (this.maxLength = count)) {
        this.firstIndex = this.maxLength;
        this.fill(undefined, 0, this.firstIndex);
    }
    return this;
};

Array.prototype.singleOrDefault = function (test, useDefault = true) {
    if (!test) test = function (x) { return true; };
    let results = this.filter((v, i) => test(v, i));
    if (results.length === 1) return results[0];
    else if (results.length > 1) throw new AmbiguousElementError();
    else if (!useDefault) throw new NoElementError();
    else return this.$default;
};

Array.prototype.single = function (test) {
    return this.singleOrDefault(test, false);
};

Array.prototype.sum = function (selector) {
    let result = 0;
    if (typeof selector === 'function')
        for (let i = 0, max = this.length; i < max; i++) {
            let val = selector(this[i], i) || 0;
            if (typeof val === 'number') result += val;
        }
    else
        for (let i = 0, max = this.length; i < max; i++) {
            let val = this[i] || 0;
            if (typeof val === 'number') result += val;
        }
    return result;
};

Array.prototype.pushDistinct = function (...items) {
    items.forEach(v => {
        let index = this.indexOf(v);
        if (index === -1) this.push(v);
    });
    return this;
};

Array.prototype.removeValue = function (...items) {
    items.forEach(v => {
        let index = this.indexOf(v);
        while (index > -1) {
            this.splice(index, 1);
            index = this.indexOf(v);
        }
    });
    return this;
};

Array.prototype.select = function (transform) {
    if (typeof transform !== 'function')
        transform = function (x) { return x; };
    return this.map((x, i) => transform(x, i));
};

Array.prototype.selectMany = function () {
    let results = [];
    for (let i = 0, m = this.length; i < m; i++) {
        if (Array.isArray(this[i]))
            results.push(...this[i]);
        else
            results.push(this[i]);
    }
    return results;
};

Array.prototype.skip = function (n = 1) {
    return this.slice(n);
};

Array.prototype.take = function (n = 1) {
    return this.slice(0, n);
};

Array.prototype.where = function (test) {
    if (typeof test !== 'function')
        test = function (x) { return true; }
    return this.filter((x, i) => test(x, i));
};


class ArrayWithMax extends Array {
    constructor(maxCount) {
        super();

        this.#firstIndex = 0;
        this.#maxCount = maxCount;
    }

    /** @type {number} */
    #firstIndex;

    /** @type {number} */
    #maxCount;

    get length() {
        return super.length;
    }

    get maxLength() {
        return this.#maxCount;
    }

    push(...items) {
        let count = super.push(...items);
        if (count > this.#maxCount) {
            let overage = this.length - this.maxLength;
            if (overage > 0) {
                this.fill(undefined, this.#firstIndex, overage);
                this.#firstIndex = overage;
            }
        }
        return count;
    }

    shift() {
        let result = this[this.#firstIndex];
        this[this.#firstIndex++] = undefined;
        return result;
    }

    unshift(...items) {
        this.splice(this.#firstIndex, items.length, ...items);
        let overage = this.length - this.maxLength;
        while (overage-- > 0) {
            this.pop();
        }
        return this.length;
    }
}

if (typeof global === 'function') {
    global.ArrayWithMax = ArrayWithMax;
}

Object.freeze(Array.prototype);

module.exports = ArrayWithMax;
