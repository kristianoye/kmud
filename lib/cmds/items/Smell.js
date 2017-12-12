MUD.include('Base', 'Daemon');

MUD.imports(LIB_VERB);

class Smell extends Verb {
    create() {
        this
            .setVerb("drop")
            .addRules(
            "",
            "OBJECT in OBJECT",
            "STRING",
            "STRING on OBJECT");
    }
}

MUD.export(Smell);
