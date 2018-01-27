MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class EmoteCommand extends Command {
    cmd(args, cmdline) {
        thisPlayer.writeLine(`You emote: ${thisPlayer.displayName} ${cmdline.input}`);
        thisPlayer.tellEnvironment(`${thisPlayer.displayName} ${cmdline.input}`);
        return true;
    }

    getHelp() {
    }
}

module.exports = EmoteCommand;
