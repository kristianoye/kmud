/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Verb = require(Base.Verb);

class Put extends Verb {
    create() {
        this
            .setVerb("put", "store")
            .addRules(
                "OBJECTS in OBJECT",
                "WORD STRING in OBJECT");
    }
    
    canPutObjectsInObject (obs, ob) {
        return true;
    }

    canPutWordStringInObject(wrd, str, obj) {
        return true;
    }

    doPutObjectsInObject(obs, target) {
        obs.forEach(ob => {
            writeLine(`You put ${ob.brief} into ${target.brief}`);
            ob.moveObject(target);
        });
        return true;
    }

    doPutWordStringInObject(wrd, str, obj) {
        return 'You do the thing';
    }
}

module.exports = Put;
