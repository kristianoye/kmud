/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Verb = await requireAsync(Base.Verb);

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
            writeLine(`You put ${ob.shortDesc} into ${target.shortDesc}`);
            ob.moveObject(target);
        });
        return true;
    }

    doPutWordStringInObject(wrd, str, obj) {
        return 'You do the thing';
    }
}

module.exports = await createAsync(Put);
