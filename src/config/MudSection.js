const
    MUDPasswordPolicy = require('./MUDPasswordPolicy'),
    ConfigUtil = require('../ConfigUtil'),
    DBManager = require('../DBManager'),
    MudPort = require('./MudPort');

class MudSection {
    constructor(data) {
        /** @type {string} */
        this.name = data.name || 'Another KMUD';

        /** @type {string} */
        this.adminName = data.adminName || '[Unspecified]';

        /** @type {string} */
        this.adminEmail = data.adminEmail || '[Unspecified]';

        this.dbm = data.databases ? new DBManager(data.databases || {}) : false;

        /** @type {Object.<string,boolean>} */
        this.features = data.features || {};

        /** @type {MUDPasswordPolicy} */
        this.passwordPolicy = new MUDPasswordPolicy(data.passwordPolicy || { minLength: 5 });

        /** @type {MudPort[]} */
        this.portBindings = (data.portBindings || []).map(p => new MudPort(p));
        if (this.portBindings.length === 0) {
            this.portBindings = MudPort.createDefaults();
        }
    }

    assertValid() {
        ConfigUtil.assertType(this.name, 'mud.name', 'string');
        ConfigUtil.assertType(this.adminName, 'mud.adminName', 'string');
        ConfigUtil.assertType(this.adminEmail, 'mud.adminEmail', 'string');
        ConfigUtil.assertType(this.features, 'mud.features', 'object');
    }

    createExport() {
        let configExport = {
            name: this.name,
            adminName: this.adminName,
            adminEmail:  this.adminEmail,
            features: this.features,
            passwordPolicy: this.passwordPolicy,
            portBindigs: this.portBindings.map(p => p.createExport())
        };

        return configExport;
    }

    getAdminEmail(flag) {
        if (flag && this.adminEmail.startsWith('#'))
            return '(protected)';
        else
            return this.adminEmail;
    }

    getAdminName(flag) {
        if (flag && this.adminName.startsWith('#'))
            return '(protected)';
        else
            return this.adminName;
    }
}

/**
 * 
 * @param {MUDPasswordPolicy} policy
 */
MudSection.createPasswordPolicyDialog = function (policy) {
    const Dialog = require('../Dialog');

    let dlg = new Dialog.MainMenu({
        text: 'Modify the requirements for passwords',
        prompt: 'Password Policy',
        help: 'Allows you to change the requirements for MUD passwords.'
    });

    //  Max password length
    dlg.add({
        text: () => {
            return `Max Password Length [currently: ${policy.maxLength}]`
        },
        char: 'x',
        callback: (maxLength) => {
            policy.maxLength = maxLength;
        },
        control: new Dialog.SimplePrompt({
            defaultValue: () => policy.maxLength,
            question: () => {
                return `Max Password Length [${policy.maxLength}]: `;
            },
            min: 0,
            type: 'number'
        })
    });

    //  Min password length
    dlg.add({
        text: () => {
            return `Min Password Length [currently: ${policy.minLength}]`
        },
        char: 'i',
        callback: (minLength) => {
            policy.minLength = minLength;
        },
        control: new Dialog.SimplePrompt({
            defaultValue: () => policy.minLength,
            question: () => {
                return `Min Password Length [${policy.minLength}]: `;
            },
            min: 0,
            type: 'number'
        })
    });

    //  Number of Upper Case Characters
    dlg.add({
        text: () => {
            return `Minimum Upper Case Characters [currently: ${policy.requiredUpper}]`
        },
        char: 'u',
        callback: (requiredUpper) => {
            policy.requiredUpper = requiredUpper;
        },
        control: new Dialog.SimplePrompt({
            defaultValue: () => policy.requiredUpper,
            question: () => {
                return `Minimum Upper Case Characters [${policy.requiredUpper}]: `;
            },
            min: 0,
            type: 'number'
        })
    });
    
    //  Required Lower Case
    dlg.add({
        text: () => {
            return `Minimum Lower Case Characters [currently: ${policy.requiredLower}]`
        },
        char: 'l',
        callback: (requiredLower) => {
            policy.requiredLower = requiredLower;
        },
        control: new Dialog.SimplePrompt({
            defaultValue: () => policy.requiredLower,
            question: () => {
                return `Minimum Lower Case Characters [${policy.requiredLower}]: `;
            },
            min: 0,
            type: 'number'
        })
    });

    //  Minimum number of digits
    dlg.add({
        text: () => {
            return `Minimum Number of Digits [currently: ${policy.requiredNumbers}]`
        },
        char: 'd',
        callback: (requiredNumbers) => {
            policy.requiredNumbers = requiredNumbers;
        },
        control: new Dialog.SimplePrompt({
            defaultValue: () => policy.requiredNumbers,
            question: () => {
                return `Minimum Number of Digits [${policy.requiredNumbers}]: `;
            },
            min: 0,
            type: 'number'
        })
    });

    //  Minimum number of special characters
    dlg.add({
        text: () => {
            return `Minimum Number of Special Characters [currently: ${policy.requiredSymbols}]`
        },
        char: 's',
        callback: (requiredSymbols) => {
            policy.requiredSymbols = requiredSymbols;
        },
        control: new Dialog.SimplePrompt({
            defaultValue: () => policy.requiredSymbols,
            question: () => {
                return `Minimum Number of Special Characters [${policy.requiredSymbols}]: `;
            },
            min: 0,
            type: 'number'
        })
    });

    dlg.add({
        text: 'Return to MUD Menu',
        char: 'm',
        callback: () => {
            Dialog.writeLine('Returning to MUD Menu');
            return Dialog.DlgResult.OK;
        }
    });

    return dlg;
};

/**
 * Configure the MUD section
 * @param {MUDSection} mud
 */
MudSection.createDialog = function (mud) {
    const Dialog = require('../Dialog');

    let dlg = new Dialog.MainMenu({
        text: 'Allows you to alter the basic settings of the MUD itself.',
        prompt: 'MUD Settings',
        help: 'Allows you to change basic settings like connection ports, client types, and administrator information.'
    });

    //  MUD Name
    dlg.add({
        text: () => {
            return `Change MUD Name [currently: ${mud.name}]`
        },
        char: 'c',
        callback: (mudName) => {
            mud.name = mudName;
        },
        control: new Dialog.SimplePrompt({
            defaultValue: () => mud.name,
            error: 'Not a valid MUD namne',
            pattern: /^[a-zA-Z]+[\w\d\ ]+/,
            question: () => {
                return `MUD Name [${mud.name}]: `;
            },
            minLength: 2,
            type: 'string'
        })
    })
    //  Admin Name
    dlg.add({
        text: () => {
            return `Change Admin Name [currently: ${mud.adminName}]`
        },
        char: 'a',
        callback: (adminName) => {
            mud.adminName = adminName;
        },
        control: new Dialog.SimplePrompt({
            defaultValue: () => mud.adminName,
            error: 'Not a valid namne',
            pattern: /^[#]*[a-zA-Z]+[\w\d\ ]+$/,
            question: () => {
                return `Admin Name [${mud.adminName}]: `;
            },
            minLength: 2,
            type: 'string'
        })
    })
    //  Admin Email
    dlg.add({
        text: () => {
            return `Change Admin Email [currently: ${mud.adminEmail}]`
        },
        char: 'e',
        callback: (adminEmail) => {
            mud.adminEmail = adminEmail;
        },
        control: new Dialog.SimplePrompt({
            defaultValue: () => mud.adminEmail,
            error: 'Not a valid email',
            pattern: /^[#]*[a-zA-Z]+[\w\d\.\_]+@[\w\d\.]+$/,
            question: () => {
                return `Admin Name [${mud.adminEmail}]: `;
            },
            minLength: 2,
            type: 'string'
        })
    });

    dlg.add({
        text: 'Change Password Policy',
        char: 'p',
        control: MudSection.createPasswordPolicyDialog(mud.passwordPolicy)
    });

    dlg.add({
        text: 'Return to Main Menu',
        char: 'm',
        callback: () => {
            Dialog.writeLine('Returning to Main Menu');
            return Dialog.DlgResult.OK;
        }
    });

    return dlg;
};

module.exports = MudSection;
