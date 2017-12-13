const
    EventEmitter = require('events'),
    { MudSetupStep } = require('./MudSetupTypes'),
    readline = require('readline');

class SectionSetup extends EventEmitter {
    /**
     * Configure a new config section
     * @param {GameSetup} owner The owner object running the setup process.
     */
    constructor(owner) {
        super();
        this.config = owner.config;
        this.console = owner.console;
        this.owner = owner;
        /** @type {MudSetupStep[]} */
        this.steps = [];
    }

    /**
     * Indicates whether the user is *required* to fill out the section.
     * @returns {boolean} True if the section must be filled out in order to work.
     */
    isRequired() {
        throw new Error('Not Implemented');
        return false;
    }

    /**
     * Execute the next step in the chain or signal that this section is done.
     * @param {function} callback - The code to execute when complete.
     */
    nextStep(callback) {
        if (this.steps.length === 0)
            callback(this);
        else
            this.steps[0].run(this.owner, () => {
                this.steps.shift(), this.nextStep(callback);
            });
    }

    /**
     * Actually run the section setup.
     * @param {function} callback The code to call when this section is done.
     */
    runSection(callback) {
        throw new Error('Not Implemented');
    }
}

module.exports = SectionSetup;

