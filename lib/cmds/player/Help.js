MUD.include('Base', 'Daemon');

MUD.imports(LIB_VERB);

var
    HelpSystem = efuns.loadObject(DAEMON_HELP);

class Help extends Verb {
    create() {
        this
            .setVerb("help")
            .addRules(
            "",
            "help",
            "STRING",
            "STRING in STRING");
    }

    canHelp() {
        return true;
    }

    canHelpString(topic) {
        return true; 
    }

    canHelpWordString(word) {
        return true;
    }

    doHelp() {
        return HelpSystem().getHelpForPlayer('index', false, thisPlayer);
    }

    doHelpString(topic) {
        return HelpSystem().getHelpForPlayer(topic, false, thisPlayer);
    }

    doHelpStringInString(category, topic) {
        return HelpSystem().getHelpForPlayer(topic, category, thisPlayer);
    }
} 

MUD.export(Help);
