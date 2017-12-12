MUD.include('Base', 'Daemon');

MUD.imports(LIB_VERB);

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
            thisPlayer.writeLine('You drop your {0}'.fs(ob.shortDescription));
            ob.moveObject(thisPlayer.environment);
        });
        return true;
    }

    doDropWordString(num, cur) {
        thisPlayer.writeLine('You drop {0} {1}'.fs(num, cur));
        return true;
    }
}

MUD.export(Drop);
