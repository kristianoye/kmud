
const
    MudSetupStep = require('../MudSetupTypes').MudSetupStep,
    path = require('path'),
    fs = require('fs');

/**
 * Helper for creating or altering the admini of the MUD.
 * TODO: Make path to save file more configurable.
 */
class AdminSetup extends MudSetupStep {
    loadCharacter(name) {

    }

    characterFilename(name) {
        let normName = name.toLowerCase().replace(/[^a-z0-9]+$/g, ''),
            filename = path.resolve(__dirname, '../../../', this.config.mudlib.base, 'sys/data/creators/', normName.charAt(0), normName + '.json');
        return filename;
    }

    pickAdminName(flag) {
        if (this.config.mud.adminCharacter && !flag) {
            this.console.question(
                `\n\nWould you like to re-configure the admin character name (existing: ${this.config.mud.adminCharacter} ? [yN]`, resp => {
                if (resp.startsWith('n')) {
                    this.callback();
                }
                else if (resp.startsWith('y')) {
                    this.pickAdminName(true);
                }
                else {
                    this.pickAdminName();
                }
            });
        }
        else {
            this.console.write('\n\nThe name given here will be made an admin on the MUD.\n');
            this.console.question(
                `\n\nPlease enter the admin character name: `, resp => {
                    if (resp.length < 3 || resp.length > 20) {
                        this.console.write('\n\nCharacter name should be between 3 and 20 characters in length.\n');
                        this.pickAdminName(true);
                    }
                    else if (!resp.match(/^[a-z0-9\-\']+$/i)) { // TODO: Add unicode support here?
                        this.console.write(`\n\nCharacter name '${resp}' contains invalid characters; Only alpha-numeric characters are allowed at this time.\n`);
                        this.pickAdminName(true);
                    }
                    else {
                        if (fs.existsSync(this.characterFile = this.characterFilename(resp))) {
                            this.console.question(
                                `\n\nA character named '${resp}' already exists; Continue? [yN] `, foo => {
                                    if (foo.startsWith('n') || foo.length === 0) {
                                        return this.pickAdminName(true);
                                    }
                                    else if (foo.startsWith('y')) {
                                        return this.pickAdminPassword({ name: resp });
                                    }
                                    else {
                                        return this.pickAdminName('y');
                                    }
                                });
                        }
                        else {
                            this.pickAdminPassword({ name: resp });
                        }
                    }
                });
        }

    }
    run(owner, callback) {
        this.callback = callback;
        this.config = owner.config;
        this.owner = owner;
        this.console = owner.console;
        this.pickAdminName();
    }
}

module.exports = AdminSetup;