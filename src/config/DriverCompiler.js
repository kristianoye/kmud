const
    ConfigUtil = require('../ConfigUtil'),
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
        this.maxCompileTime = ConfigUtil.parseTime(data.maxCompileTime || 2000);

        /** @type {number} */
        this.maxConstructorTime = ConfigUtil.parseTime(data.maxConstructorTime || 1000);
    }

    assertValid() {
        ConfigUtil.assertType(this.maxCompileTime, 'driver.compiler.maxCompileTime', 'number');
        ConfigUtil.assertType(this.maxConstructorTime, 'driver.compiler.maxConstructorTime', 'number');
        ConfigUtil.assertType(this.virtualMachine, 'driver.compiler.virtualMachine', 'string');
        if (['vm', 'vm2'].indexOf(this.virtualMachine) === -1)
            throw new Error(`driver.compiler.vm setting is invalid; Must be either 'vm' or 'vm2' and not ${this.virtualMachine}`);
    }
}

module.exports = DriverCompiler;
