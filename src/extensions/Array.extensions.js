/*
 * Extensions to the Array object
 * Lots of LINQ-like functionality
 */

Array.prototype.any = function (test) {
    if (!test) test = function (x) { return true; };
    for (let i = 0; i < this.length; i++) {
        if (test(this[i], i)) return true;
    }
    return false;
};

Array.prototype.default = function (val) {
    this.$default = val;
    return this;
};

Array.prototype.firstOrDefault = function (test) {
    if (!test) test = function(x) { return true; };
    for (let i = 0; i < this.length; i++) {
        if (test(this[i], i)) return this[i];
    }
    return this.$default;;
};

Array.prototype.forEachAsync = async function (callback) {
    if (/^async /.test(callback.toString()) === false)
        throw new Error('Callback must be async');
    for (let i = 0; i < this.length; i++) {
        await callback(this[i], i);
    }
    return this;
};

Array.prototype.lastOrDefault = function (test) {
    if (!test) test = function (x) { return true; };
    for (let i = this.length - 1; i > -1; i--) {
        if (test(this[i], i)) return this[i];
    }
    return this.$default;;
};

Array.prototype.singleOrDefault = function (test, useDefault = true) {
    if (!test) test = function (x) { return true; };
    let results = this.filter((v, i) => test(v, i));
    if (results.length === 1) return results[0];
    else if (results.length > 1) throw new Error('Sequence contains more than watching element');
    else if (!useDefault) throw new Error('No matching element');
    else return this.$default;
};

Array.prototype.single = function (test) {
    return this.singleOrDefault(test, false);
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
    if (typeof transform !== 'function') transform = function (x) { return x; };
    return this.map((x, i) => transform(x, i));
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

Object.freeze(Array.prototype);
