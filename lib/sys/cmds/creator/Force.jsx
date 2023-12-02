/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_VERB } from 'Base';
import Verb from LIB_VERB;

export default final singleton class ForceCommand extends Verb {
    override create() {
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
        writeLine(`You force ${liv.displayName} to ${cmd}`);
        liv.eventForce(cmd);
        return true;
    }
}
