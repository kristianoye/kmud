class MUDCompilerOptions {
    /**
     * 
     * @param {Partial<MUDCompilerOptions>} options
     */
    constructor(options) {
        /**
         * @type {MUDObject}
         */
        this.altParent = options.altParent;

        /**
         * Arguments to pass to the constructor of the default instance created.
         * @type {any[]}
         */
        this.args = Array.isArray(options.args) ? options.args : [];

        /**
         * The file to compile
         * @type {string}
         */
        this.file = options.file;

        /**
         * Does the target module define a mixin?
         * @type {boolean}
         */
        this.isMixin = typeof options.isMixin === 'boolean' ? options.isMixin === true : false;

        /**
         * Is this a request to compile a virtual object?
         */
        this.isVirtual = typeof options.isVirtual === 'boolean' ? options.isVirtual === true : false;

        /**
         * No instances are created automatically by the driver if this option is true
         * @type {boolean}
         */
        this.noCreate = typeof options.noCreate === 'boolean' ? options.noCreate === true : false;

        /**
         * If true then types in the module can be modified in the runtime
         * @type {boolean}
         */
        this.noSeal = typeof options.noSeal === 'boolean' ? options.noSeal === true : false;

        /**
         * A callback that executes when the compiler completes.
         * @type {function(string,number): void}
         */
        this.onDebugOutput = typeof options.onDebugOutput === 'function' && options.onDebugOutput || function (msg, lvl) { };

        /**
         * A callback that executes when the compiler constructs an object instance.
         * @type {function(string,number): void}
         */
        this.onInstanceCreated = typeof options.onInstanceCreated === 'function' && options.onInstanceCreated || function (inst) { };

        /**
         * A callback that executes when the compiler completes.
         * @type {function}
         */
        this.onPipelineComplete = typeof options.onPipelineComplete === 'function' && options.onPipelineComplete || function () { };

        /**
         * A callback that executes when the compiler completes.
         * @type {function(string,number,number)}
         */
        this.onPipelineStage = typeof options.onPipelineStage === 'function' && options.onPipelineStage || function () { };


        this.relativePath = typeof options.relativePath === 'string' && options.relativePath;

        /**
         * Is this a reload request?
         * @type {boolean}
         */
        this.reload = options.reload === true;

        /**
         * Should we re-compile all dependent modules?
         */
        this.reloadDependents = typeof options.reloadDependents === 'boolean' ? options.reloadDependents === true : false;

        /**
         * We are compiling/evaluating a block of code
         * @type {string}
         */
        this.source = typeof options.source === 'string' && options.source;

        for (const [key, val] of Object.entries(options)) {
            if (key in this === false) {
                console.log(`Warning: Unrecognized compiler option: ${key} = ${val}`);
            }
        }
    }

    /**
     * Create a child compiler option based on existing settings
     * @param {string} filename The target module path for the new settings
     * @returns {MUDCompilerOptions}
     */
    createChildOptions(filename) {
        let clone = new MUDCompilerOptions(Object.assign({}, this, { filename, file: filename }));

        return clone;
    }
}

module.exports = MUDCompilerOptions;
