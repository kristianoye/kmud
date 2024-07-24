Object.prototype.forEach = function (callback) {
    Object.keys(this).forEach((key, index) => {
        callback.call(this, this[key], index);
    });
};

Object.forEach = function (target, callback) {
    if (typeof target !== 'object' || target === null)
        throw new Error('Bad argument 1 to Object.forEach');

    Object.getOwnPropertyNames(target).forEach(function (key) {
        callback.call(target, key, target[key]);
    });
    return target;
};

Object.mapEach = function (target, callback) {
    var arr = [], obj = {}, ac = 0, oc = 0, c = 0;
    if (typeof target !== 'object' || target === null)
        throw new Error('Bad argument 1 to Object.mapEach');

    Object.getOwnPropertyNames(target).forEach(key => {
        var result = callback.call(target, key, target[key], c++);
        if (typeof result !== 'undefined') {
            if (Array.isArray(result) && result.length === 2) {
                if (typeof result[0] !== 'string')
                    throw new Error('Key must be a string');
                obj[result[0]] = result[1];
                oc++;
            }
            else {
                arr.push(result);
                ac++;
            }
        }
    });
    if (ac > 0 && oc > 0) {
        throw new Error(`Object.forEach returned ${oc} object key/value pairs and ${ac} array elements; Must be all of one type.`);
    }
    return ac > 0 ? arr : obj;
};

if (__ivc === true) {
    __igt(Object);
    __igt(Object.prototype);
}
