
const
    readline = require('readline'),
    { StringValidator, ConfigQuestion, MudSetupStep } = require('./MudSetupTypes'),
    SectionSetup = require('./SectionSetup');

class GeneralMueSettings extends SectionSetup {
    /**
     * 
     * @param {GameSetup} owner The setup object that owns this section.
     */
    constructor(owner) {
        super(owner);
        this.name = "MUD Settings";
        this.steps = [
            new ConfigQuestion('mud.name',
                'What shall you name this MUD?',
                'The MUD name is displayed in many commands and on the Intermud network (if enabled).',
                `KMUD #${+new Date().getTime()}`,
                [
                    new StringValidator({ minLength: 3, maxLength: 100 })
                ]),
            new ConfigQuestion('mud.adminName',
                'What is the real name of the primary admin?',
                'This is the name of the primary administrator that may be contacted if a player has problems.\n' +
                'This may be the name of a servicing account if the MUD is administered by multiple people.',
                'Not Specified',
                [
                    new StringValidator({ minLength: 3, maxLength: 100 })
                ]),
            new ConfigQuestion('mud.adminEmail',
                'What is the email of the primary admin?',
                'The administrative email may be displayed in places where players look to seek help.  Prefix\n' +
                'the e-mail address with a # in order to keep it private',
                'Not Specified',
                [
                    new StringValidator({
                        maxLength: 120,
                        regex: /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
                    })
                ]),
            new ConfigQuestion('mud.adminCharacter', 
                'What is the character name of the primary admin? ',
                'This character will be pre-created and automatically made an admin before you log in.',
                'Not Specified',
                [
                    new StringValidator({
                        minLength: 3,
                        maxLength: 20,
                        regex: /^[a-zA-Z0-9]{3,20}$/
                    })
                ], function (value) {

                    return value;
                })
        ];
    }

    isRequired() {
        if (!this.config.mud.name ||
            !this.config.mud.adminName ||
            !this.config.mud.adminEmail ||
            !this.config.mud.portBindings)
            return true;

        if (!Array.isArray(this.config.mud.portBindings))
            return true;

        if (this.config.mud.portBindings.length === 0)
            return true;

        return false;
    }

    /**
     * Actually run the section setup.
     * @param {function} callback The code to call when this section is done.
     */
    run(callback) {
        this.nextStep(callback);
    }

    runSection(callback) {
        if (!this.isRequired()) {
            this.owner.console.question(`\n\nWould you like to configure MUD settings? [y/N] `, resp => {
                if (resp.toLowerCase().startsWith('y')) {
                    this.run(callback);
                }
                else if (resp.length === 0 || resp.toLowerCase().startsWith('n')) {
                    callback(this);
                }
                else {
                    this.runSection(callback);
                }
            });
        }
        else this.run(callback);
    }
}

module.exports = GeneralMueSettings;
