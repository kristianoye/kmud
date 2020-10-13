const
    ShellObject = await requireAsync('/base/ShellObject');

class GetItem extends ShellObject {
    constructor() {
        this.verb = 'Get-Item';
        this.setParameters({

        });
    }

    /**
     * Patterns to exclude
     * @type {string[]}
     */
    #exclude = null;

    /**
     * Patterns to include
     * @type {string[]}
     */
    #filter = null;

    /**
     * Force the retrieval of hidden and system files
     * @type {boolean}
     */
    #force = false;

    /**
     * The fully-resolved path to the file
     * @type {string} The full path
     */
    #fullPath;

    set exclude(value) {
        if (typeof value === 'string')
            this.#exclude = value.split(',');
    }

    set force() {
        this.#force = true;
    }

    set include(value) {
        if (typeof value === 'string')
            this.#include = value.split(',');
    }

    set literalPath(value) {
        this.#fullPath = value;
    }

    set path(value) {
        this.#fullPath = path.join(cwd, value);
    }
}

module.exports = { GetItem };
