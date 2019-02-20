/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Verb = require(Base.Verb);

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
            write(`You get ${ob.brief}`);
            ob.moveObject(thisPlayer);
        });
        return true;
    }

    doGetObjectsFromObject(obs,target) {
        obs.forEach(ob => {
            write(`You get ${ob.brief} from the ${efuns.removeArticle(target.brief)}`);
            ob.moveObject(thisPlayer);
        });
        return true;
    }

    doGetWordString(num, cur) {
        write(`You drop ${num} ${cur}`);
        return true;
    }
}

module.exports = Get;
