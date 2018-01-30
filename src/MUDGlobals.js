
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

    freeze(ob) {
        if (typeof ob === 'object') {
            Object.keys(ob).forEach(k => {
                this.freeze(ob[k]);
            });
            Object.freeze(ob);
        }
        return ob;
    }

    modifyLoader(loaderPrototype) {
        Object.keys(this).forEach(key => {
            let val = this.freeze(this[key]);
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
