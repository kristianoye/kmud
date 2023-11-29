/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_VERB } from 'Base';
import Verb from LIB_VERB;

export default singleton class Drop extends Verb {
    create() {
        this
            .setVerb("drop")
            .addRules(
                "OBJECTS",
                "WORD STRING");
    }

    canDropObjects(ob) {
        if (!thisPlayer().environment)
            return 'You are in the void!';
        return true;
    }

    canDropWordString(num, cur) {
        var amt = parseInt(num);
        if (!amt)
            return false;
        return true;
    }

    /**
     * 
     * @param {MUDObject[]} obs
     */
    async doDropObjects(obs) {
        await obs.forEachAsync(async ob => {
            writeLine(`You drop your ${ob.shortDesc}`);
            await ob.moveObjectAsync(thisPlayer().environment);
        });
        return true;
    }

    doDropWordString(num, cur) {
        writeLine(`You drop ${num} ${cur}`);
        return true;
    }
}
