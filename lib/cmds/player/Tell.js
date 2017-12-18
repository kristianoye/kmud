
MUD.include('Base');

MUD.imports(LIB_VERB);

class Tell extends Verb {
    create() {
            this.setVerb("tell")
            .addRules(
                "PLAYER STRING",
                "PLAYER in WORD STRING",
                "LIVING STRING",
                "LIVING in WORD STRING");
    }

    canTellPlayerString(player, msg) {

    }
}
