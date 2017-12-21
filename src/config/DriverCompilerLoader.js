const
    fs = require('fs'),
    resolvePath = require('./ConfigShared').resolvePath;

class DriverCompilerLoader {
    constructor(data, id) {
        /** @type {boolean} */
        this.enabled = true;

        /** @type {string} */
        this.id = id;

        /** @type {string} */
        this.name = data.name;

        /** @type {string} */
        this.file = data.file;
    }

    assertValid() {
        if (!this.name)
            throw new Error(`Loader with ID ${this.id} did not specify a name.`);
        if (!this.id)
            throw new Error(`Loader with name ${this.name} did not specify an ID.`);
        if (!fs.existsSync(resolvePath(this.file)))
            throw new Error(`Failed to locate specified loader: ${this.file}`);
    }
}

module.exports = DriverCompilerLoader;
