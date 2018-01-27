MUD.include('Base', 'Daemon');

const
    Verb = require(LIB_VERB);

var
    HelpSystem;

class HelpCommand extends Verb {
    create() {
        HelpSystem = efuns.loadObject(DAEMON_HELP);
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

    canHelpHelp() {
        return true;
    }

    canHelpString(topic) {
        return true; 
    }

    canHelpStringInString(word) {
        return true;
    }

    doHelp() {
        return HelpSystem().getHelpForPlayer('index', false, thisPlayer);
    }

    doHelpHelp() {
        write('Prints this helpful message.');
        return true;
    }

    /**
     * 
     * @param {MUDCommandHelp} help
     */
    displayCommandHelp(help) {
        let buffer = `Category: ${help.category}`;
        buffer += '\nNAME:\n' + help.command + '\n';
        buffer += '\nDESCRIPTION:\n' + efuns.wrapText(help.description) + '\n';
        write(buffer);
        return true;
    }

    /**
     * Display help
     * @param {MUDHelp} help
     */
    displayHelp(help) {
        switch (help.type) {
            case 'command':
                return this.displayCommandHelp(help);
        }
    }

    doHelpString(topic) {
        let help = HelpSystem().getHelp(topic, false);
        if (help.length === 0)
            return `Could not find help for '${topic}'; Try typing 'help index'`;
        else if (help.length === 1)
            return this.displayHelp(help[0]);
        else {
            // Ambiguous
        }
        return true;
    }

    doHelpStringInString(category, topic) {
        return HelpSystem().getHelpForPlayer(topic, category, thisPlayer);
    }
} 

module.exports = HelpCommand;
