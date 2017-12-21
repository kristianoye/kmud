const
    MUDCompilerComponentConfig = require('./MUDCompilerComponentConfig'),
    MUDCompilerLanguageConfig = require('./MUDCompilerLanguageConfig'),
    MUDLoaderConfig = require('./MUDLoaderConfig');

class MUDCompilerSection {
    constructor(data) {
        /** @type {string} */
        this.virtualMachine = data.virtualMachine || 'vm';

        /** @type {MUDCompilerComponentConfig[]} */
        this.components = Array.isArray(data.components) ? data.components.map(c => new MUDCompilerComponentConfig(c)) : [];

        /** @type {Object.<string,MUDCompilerLanguageSection>} */
        this.languages = {};
        Object.keys(data.languages).forEach(ext => {
            this.languages[ext] = new MUDCompilerLanguageConfig(data.languages[ext], ext);
        });

        /** @type {Object.<string,MUDLoaderConfig>} */
        this.loaders = {};
        Object.keys(data.loaders).forEach(id => {
            this.loaders[id] = new MUDLoaderConfig(data.loaders[id], id);
        });
    }
}

module.exports = MUDCompilerSection;
