
class CommandShellOptions {
    /**
     * Construct new shell options
     * @param {CommandShellOptions} opts
     */
    constructor(opts = {}) {
        this.aliases = {};

        /** @type {boolean} */
        this.allowEscaping = typeof opts.allowEscaping === 'boolean' ? opts.allowEscaping : false;

        /** @type {boolean} */
        this.allowFileIO = typeof opts.allowFileIO === 'boolean' ? opts.allowFileIO : false;

        /** @type {boolean} */
        this.allowLineSpanning = typeof opts.allowLineSpanning === 'boolean' ? opts.allowLineSpanning : true;

        /** @type {boolean} */
        this.allowPipelining = typeof opts.allowPipelining === 'boolean' ? opts.allowPipelining : false;

        /** @type {string} */
        this.cwd = typeof opts.cwd === 'string' ? opts.cwd : '/';

        /** @type {Object.<string,any>} */
        this.environment = opts.environment || {};

        /** @type {boolean} */
        this.expandAliases = typeof opts.expandAliases === 'boolean' ? opts.expandAliases : true;

        /** @type {boolean} */
        this.expandBackticks = typeof opts.expandBackticks === 'boolean' ? opts.expandBackticks : false;

        /** @type {boolean} */
        this.expandEnvironment = typeof opts.expandEnvironment === 'boolean' ? opts.expandEnvironment : true;

        /** @type {boolean} */
        this.expandFileExpressions = typeof opts.expandFileExpressions === 'boolean' ? opts.expandFileExpressions : false;

        /** @type {boolean} */
        this.expandVariables = typeof opts.expandVariables === 'boolean' ? opts.expandVariables : true;

        /** @type {string[]} */
        this.history = opts.history || [];

        /**
         * Dictates how history is expanded: 0=No history expansion, 1=Only verb is expanded, 2=Verb/Arguments are expanded 
         * @type {number} */
        this.historyLevel = opts.historyLevel || 0;

        /** @type {Object.<string,any>} */
        this.variables = opts.variables || {};
    }
}

module.exports = CommandShellOptions;