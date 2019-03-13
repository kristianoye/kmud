const
    ConfigUtil = require('../ConfigUtil'),
    DriverCompilerComponent = require('./DriverCompilerComponent'),
    DriverCompilerLanguage = require('./DriverCompilerLanguage'),
    DriverCompilerLoader = require('./DriverCompilerLoader');

class DriverCompiler {
    constructor(data) {
        /** @type {string} */
        this.virtualMachine = data.virtualMachine || 'vm';

        /** @type {boolean} */
        this.sealTypesAfterCompile = data.sealTypesAfterCompile || false;

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
        ConfigUtil.assertType(this.sealTypesAfterCompile, 'driver.compiler.sealTypesAfterCompile', 'boolean');
        if (['vm', 'vm2'].indexOf(this.virtualMachine) === -1)
            throw new Error(`driver.compiler.vm setting is invalid; Must be either 'vm' or 'vm2' and not ${this.virtualMachine}`);
    }
}

// Default compiler settings.
DriverCompiler.defaults = {
    maxCompileTime: 2000,
    maxConstructorTime: 1000,
    sealTypesAfterCompile: true,
    virtualMachine: "vm",
    components: [
        {
            id: "MudScriptTranspiler",
            name: "MudScript Transpiler",
            file: "./compiler/MudScriptTranspiler"
        }
    ],
    languages: {
        ".js": {
            id: "JavaScript",
            loader: "MUDLoader",
            loaderOptions: {},
            name: "JavaScript Pipeline",
            pipeline: [
                {
                    id: "MudScriptTranspiler",
                    name: "Transpiler Without JSX",
                    allowJsx: false
                }
            ]
        },
        ".jsx": {
            id: "JSX",
            enabled: true,
            loader: "MUDLoader",
            loaderOptions: {},
            name: "JSX Pipeline",
            pipeline: [
                {
                    id: "MudScriptTranspiler",
                    name: "Transpiler with JSX",
                    allowJsx: true
                }
            ]
        }
    },
    loaders: {
        MUDLoader: {
            name: "KMUD Standard Loader",
            file: "./MUDLoader"
        },
        MUDOSLoader: {
            name: "MudOS Compatibility Loader",
            file: "./MUDOSLoader"
        }
    }
};

module.exports = DriverCompiler;
