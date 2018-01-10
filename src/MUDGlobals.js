
class MUDGlobals {
    define(prop, val) {
        Object.defineProperty(global, prop, {
            value: val,
            writable: false
        });
        Object.defineProperty(this, prop, {
            value: val,
            writable: false
        });
        return this;
    }

    modifyLoader(loaderPrototype) {
        Object.keys(this).forEach(key => {
            let val = this[key];

            if (typeof val === 'object')
                Object.freeze(val);     

            if (!(key in global)) {
                Object.defineProperty(global, key, {
                    value: val,
                    writable: false
                });
            }
            Object.defineProperty(loaderPrototype, key, {
                value: val,
                writable: false
            });
        });
        Object.freeze(this);
    }
}

global.mudglobal = new MUDGlobals();

module.exports = MUDGlobals;
