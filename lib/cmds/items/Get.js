/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_VERB } from 'Base';
import Verb from LIB_VERB;

export default singleton class Get extends Verb {
    override create() {
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

    async doGetObjects(obs) {
        let moveCount = 0;

        for (const ob of obs) {
            writeLine(`You get ${ob.shortDesc}`);
            if (await ob.moveObjectAsync(thisPlayer))
                moveCount++;
        }
        return moveCount > 0 ? true : 'You did get anything';
    }

    async doGetObjectsFromObject(obs,target) {
        let moveCount = 0;

        for (const ob of obs) {
            writeLine(`You get ${ob.shortDesc} from the ${efuns.removeArticle(target.shortDesc)}`);
            if (await ob.moveObjectAsync(thisPlayer))
                moveCount++;
        }
        return moveCount > 0 ? true : `You did get anything from ${efuns.removeArticle(target.shortDesc)}`;
    }

    doGetWordString(num, cur) {
        writeLine(`You drop ${num} ${cur}`);
        return true;
    }
}
