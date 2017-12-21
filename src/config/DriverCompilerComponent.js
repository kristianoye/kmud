const
    fs = require('fs'),
    resolvePath = require('./ConfigShared').resolvePath;

var
    nextComponentId = 1;

class DriverCompilerComponent {
    constructor(data) {
        /** @type {string} */
        this.id = data.id || 'Component #' + nextComponentId;

        /** @type {string} */
        this.name = data.name || 'Unnamed Component #' + nextComponentId;

        /** @type {string} */
        this.file = data.file;

        /** @type {boolean} */
        this.enabled = typeof data.enabled === 'boolean' ? data.enabled : true;

        if (!fs.existsSync(resolvePath(this.file = data.file)))
            throw new Error(`Component ${this.name} [id ${this.id}] has invalid filename: ${this.file}`);
        nextComponentId++;
    }
}

module.exports = DriverCompilerComponent;

