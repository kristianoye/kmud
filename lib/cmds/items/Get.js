MUD.include('Base', 'Daemon');

MUD.imports(LIB_VERB);

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
            thisPlayer.writeLine('You get {0}'.fs(ob.shortDescription));
            ob.moveObject(thisPlayer);
        });
        return true;
    }

    doGetObjectsFromObject(obs,target) {
        obs.forEach(ob => {
            thisPlayer.writeLine(`You get ${ob.shortDescription} from the ${efuns.removeArticle(target.shortDescription)}`);
            ob.moveObject(thisPlayer);
        });
        return true;
    }

    doDropWordString(num, cur) {
        thisPlayer.writeLine('You drop {0} {1}'.fs(num, cur));
        return true;
    }
}

MUD.export(Get);
