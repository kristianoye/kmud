MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Emote extends Command {
    cmd(args, cmdline) {
        thisPlayer.writeLine('You emote: {0} {1}'.fs(thisPlayer.displayName, cmdline.input));
        thisPlayer.tellEnvironment('{0} {1}'.fs(thisPlayer.displayName, cmdline.input));
        return true;
    }

    getHelp() {
    }
}

MUD.export(Emote);
