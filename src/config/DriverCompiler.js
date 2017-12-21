const
    DriverCompilerComponent = require('./DriverCompilerComponent'),
    DriverCompilerLanguage = require('./DriverCompilerLanguage'),
    DriverCompilerLoader = require('./DriverCompilerLoader');

class DriverCompiler {
    constructor(data) {
        /** @type {string} */
        this.virtualMachine = data.virtualMachine || 'vm';

        /** @type {DriverCompilerComponent[]} */
        this.components = Array.isArray(data.components) ? data.components.map(c => new DriverCompilerComponent(c)) : [];

        /** @type {Object.<string,DriverCompilerLanguage>} */
        this.languages = {};
        Object.keys(data.languages).forEach(ext => {
            this.languages[ext] = new DriverCompilerLanguage(data.languages[ext], ext);
        });

        /** @type {Object.<string,DriverCompilerLoader>} */
        this.loaders = {};
        Object.keys(data.loaders).forEach(id => {
            this.loaders[id] = new DriverCompilerLoader(data.loaders[id], id);
        });

        /** @type {number} */
        this.maxCompileTime = data.maxCompileTime || 2000;

        /** @type {number} */
        this.maxConstructorTime = data.maxConstructorTime || 1000;
    }

    assertValid() {
        if (typeof this.maxCompileTime !== 'number')
            throw new Error(`driver.compiler.maxCompile time must be numeric: Got ${this.maxCompileTime}`);
        if (typeof this.maxConstructorTime !== 'number')
            throw new Error(`driver.compiler.maxConstructorTime time must be numeric: Got ${this.maxConstructorTime}`);
        if (typeof this.virtualMachine !== 'string')
            throw new Error(`driver.compiler.vm setting is invalid; Must be string and not ${typeof this.virtualMachine}`);
        if (['vm', 'vm2'].indexOf(this.virtualMachine) === -1)
            throw new Error(`driver.compiler.vm setting is invalid; Must be either 'vm' or 'vm2' and not ${this.virtualMachine}`);
    }
}

module.exports = DriverCompiler;
