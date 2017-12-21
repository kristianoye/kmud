

class DriverCompilerLanguage {
    constructor(data, ext) {
        /** @type {string} */
        this.id = data.id;

        /** @type {string} */
        this.extension = ext;

        /** @type {string} */
        this.loader = data.loader || 'MUDLoader';

        /** @type {string} */
        this.name = data.name || 'Unknown Language';

        /** @type {string} */
        this.pipeline = data.pipeline;
    }
}


module.exports = DriverCompilerLanguage;
