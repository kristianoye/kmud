
const
    Verb = require('../../../base/Verb');

class ForceCommand extends Verb {
    create() {
        this.setVerb('force')
            .addRules("LIV to STR")
            .setSynonyms("cooerce");
    }

    canForceLivingToString(liv, cmd) {
        if (efuns.wizardp(thisPlayer)) {
            if (efuns.archp(liv) && !efuns.archp(thisPlayer)) {
                return 'Your powers are not that great.';
            }
            if (efuns.adminp(liv)) {
                return 'You are playing with fire.';
            }
            return true;
        }
        return 'Only immortals have that ability.';
    }

    doForceLivingToString(liv, cmd) {
        efuns.write(`You force ${liv.displayName} to ${cmd}`);
        liv.eventForce(cmd);
        return true;
    }
}

module.exports = ForceCommand;