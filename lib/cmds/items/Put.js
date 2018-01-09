MUD.include('Base', 'Daemon');

MUD.imports(LIB_VERB);

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

    doPutObjectsInObject(obs, target) {
        obs.forEach(ob => {
            thisPlayer.writeLine(`You put ${ob.shortDescription} into ${target.shortDescription}`);
            ob.moveObject(target);
        });
        return true;
    }
}

MUD.export(Put);
