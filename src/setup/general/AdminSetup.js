
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
            this.console.write(`
You already have an admin character listed in the configuration file.  No 
attempt was made to validate whether or not this character exists or whether
they have admin rights within the MUD.  You may choose to skip this step by
selecting No or you may proceed with admin character setup by selecting Yes.

Existing admin name: '${this.config.mud.adminCharacter}'
`);
            this.console.question(
                `\n\MUD Settings:Admin Character:Create/Update? [yN] `, resp => {
                if (resp.length === 0 || resp.startsWith('n')) {
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
                `\n\nMUD Settings:Admin Character:Name> [${(this.config.mud.adminCharacter || 'Admin')}] `, resp => {
                    if (resp.length === 0) {
                        resp = this.config.mud.adminCharacter || 'Admin';
                    }
                    if (resp.length < 3 || resp.length > 20) {
                        this.console.write('\n\nCharacter name should be between 3 and 20 characters in length.\n');
                        this.pickAdminName(true);
                    }
                    else if (!resp.match(/^[a-z0-9\-\']+$/i)) { // TODO: Add unicode support here?
                        this.console.write(`\n\nCharacter name '${resp}' contains invalid characters; Only alpha-numeric characters are allowed at this time.\n`);
                        this.pickAdminName(true);
                    }
                    else {
                        this.config.mud.adminCharacter = resp.trim();
                        this.pickAdminPassword();
                    }
                });
        }
    }

    pickAdminPassword() {
        let owner = this.owner, master = owner.origin;
        this.console.question(`
Please enter a password for admin character named '${this.config.mud.adminCharacter}'

MUD Settings:Admin Character:Pasword for ${this.config.mud.adminCharacter}> `, resp => {
                master.createRunOnce({
                    eventType: 'createAdmin',
                    eventUsername: this.config.mud.adminCharacter,
                    eventPassword: resp
                });
                this.callback();
            });
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