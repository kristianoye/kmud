const
    readline = require('readline');

class ConfigValidator {
    /**
     * @param {any} k The key ID of the value being collected
     * @param {any} s The value entered by the user
     */
    valid(k, s) { return true; }
}

class StringValidator {
    constructor(opts) {
        this.options = opts;
    }

    /**
     * @param {string} k The key ID to validate.
     * @param {string} s The value to validate.
     */
    valid(k, s) {
        if (this.options.minLength && s.length < this.options.minLength) {
            return `\nValue for ${k} is too short; Must be at least ${this.options.minLength} character(s) long.\n`;
        }
        if (this.options.maxLength && s.length > this.options.maxLength) {
            return `\nValue for ${k} is too long; Must be less than ${this.options.minLength} character(s) long.\n`;
        }
        if (this.options.regex && !this.options.regex.test(s)) {
            return `\nValue for ${k} contains invalid characters.\n`;
        }
        return true;
    }
}

class MudSetupStep {
    constructor() { }

    /**
     * @param {GameSetup} owner The owner of this step.
     * @param {function} callback The code to execute when the step is done.
     */
    run(owner, callback) {
        throw new Error('Not Implemented');
    }
}

class ConfigQuestion extends MudSetupStep {
    constructor(property, prompt, text, defaultValue, validation, serializer) {
        super();

        this.text = text;
        this.prompt = prompt;
        this.property = property;
        this.defaultValue = defaultValue;
        /** @type {ConfigValidator[]} */
        this.validation = validation || [];
        /** @type {function} */
        this.serializer = serializer || function (s) { return s; };
    }

    /**
     * @param {function} callback The code to execute when the step is done.
     */
    askQuestion(callback) {
        if (this.text)
            this.owner.console.write(`\n\n\n${this.text}\n`);
        var currentValue = this.owner.getCurrentValue(this.property, this.defaultValue);
        this.owner.console.question(`\n\n${this.prompt} [${currentValue}] `, (response) => {
            if (!response || response.length === 0) response = currentValue;
            for (var i = 0, configValue = this.serializer(response); i < this.validation.length; i++) {
                var valid = this.validation[i].valid(this.property, configValue);
                if (valid !== true) {
                    if (typeof valid === 'string') this.owner.console.write(valid);
                    return this.askQuestion(callback);
                }
            }
            this.owner.assignValue(this.property, configValue);
            callback();
        });
    }

    /**
     * @param {GameSetup} owner The owner of this step.
     * @param {function} callback The code to execute when the step is done.
     */
    run(owner, callback) {
        this.owner = owner;
        return this.askQuestion(callback);
    }
}

module.exports = {
    ConfigValidator: ConfigValidator,
    ConfigQuestion: ConfigQuestion,
    MudSetupStep: MudSetupStep,
    StringValidator: StringValidator
};