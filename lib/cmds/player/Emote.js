MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Emote extends Command {
    cmd(args, cmdline) {
        thisPlayer.writeLine(`You emote: ${thisPlayer.displayName} ${cmdline.input}`);
        thisPlayer.tellEnvironment(`${thisPlayer.displayName} ${cmdline.input}`);
        return true;
    }

    getHelp() {
    }
}

MUD.export(Emote);
