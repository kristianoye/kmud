const
    MUDData = require('./MUDData'),
    MUDObject = require('./MUDObject');

class ObjectProxy {
    constructor(_target) {
        var _proxy = new Proxy(_target, {
            apply: function (target, thisArg, args) {
                return target.apply(thisArg, args);
            },
            getOwnPropertyDescriptor: function (target, prop) {
                return Object.getOwnPropertyDescriptor(target, prop);
            },
            getPrototypeOf: function (target) {
                if (target === _target) return true;
                else if (target === this) return true;
                else return _target.prototype instanceof target;
            },
            has: function (target, prop) {
                return prop in _target;
            }
        });
    }
}

module.exports = ObjectProxy;
