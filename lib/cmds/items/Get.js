/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Verb = await requireAsync(Base.Verb);

class Get extends Verb {
    create() {
        this
            .setVerb("get", "grab", "take")
            .addRules(
                "OBJECTS",
                "OBJECTS from OBJECT",
                "WORD STRING");
    }

    canGetObjects(obs) {
        obs.forEach(ob => {
            if (ob.environment === thisPlayer) {
                return 'You already have it!';
            }
        });
        return true;
    }

    canGetObjectsFromObject(obs) {
        obs.forEach(ob => {
            if (ob.environment === thisPlayer) {
                return 'You already have it!';
            }
        });
        return true;
    }

    canGetWordString(num, cur) {
        var amt = parseInt(num);
        if (!amt)
            return false;
        return true;
    }

    doGetObjects(obs) {
        obs.forEach(ob => {
            writeLine(`You get ${ob.shortDesc}`);
            ob.moveObject(thisPlayer);
        });
        return true;
    }

    doGetObjectsFromObject(obs,target) {
        obs.forEach(ob => {
            writeLine(`You get ${ob.shortDesc} from the ${efuns.removeArticle(target.shortDesc)}`);
            ob.moveObject(thisPlayer);
        });
        return true;
    }

    doGetWordString(num, cur) {
        writeLine(`You drop ${num} ${cur}`);
        return true;
    }
}

module.exports = Get;
