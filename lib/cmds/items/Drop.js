/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Verb = require(Base.Verb);

class Drop extends Verb {
    create() {
        this
            .setVerb("drop")
            .addRules(
                "OBJECTS",
                "WORD STRING");
    }

    canDropObjects(ob) {
        if (!thisPlayer.environment)
            return 'You are in the void!';
        return true;
    }

    canDropWordString(num, cur) {
        var amt = parseInt(num);
        if (!amt)
            return false;
        return true;
    }

    doDropObjects(obs) {
        obs.forEach(ob => {
            thisPlayer.writeLine(`You drop your ${ob.shortDescription}`);
            ob.moveObject(thisPlayer.environment);
        });
        return true;
    }

    doDropWordString(num, cur) {
        thisPlayer.writeLine(`You drop ${num} ${cur}`);
        return true;
    }
}

module.exports = Drop;
