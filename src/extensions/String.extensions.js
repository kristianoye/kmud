/*
 * Extensions to the String object
 */


String.prototype.countInstances = function (word) {
    let substrings = this.split(word);
    return substrings.length - 1;
};

String.prototype.fs = function (...args) {
    let a = [].slice.call(arguments),
        s = this;

    for (var i = 0; i < a.length; i++) {
        var re = new RegExp('\\{' + i + '\\}', 'g');
        s = s.replace(re, typeof a[i] === 'undefined' ? '[undefined]' : a[i].toString());
    }
    return s;
};

String.prototype.ucfirst = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

Object.seal(String.prototype);
