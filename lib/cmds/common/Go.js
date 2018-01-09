MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Go extends Command {
    cmd(args, cmdline) {
        var env = thisPlayer.environment;
        if (args.length === 0) {
            thisPlayer.writeLine('Which way do you wish to go?');
        }
        else if (!env) {
            thisPlayer.writeLine('You appear to be in the void');
        }
        else if (!env.hasExit(args[0])) {
            thisPlayer.writeLine('You cannot go that way');
        }
        else {
            thisPlayer.eventMove('walk', args[0], env.getExit(args[0]));
            thisPlayer.writeLine(`You go ${args[0]}`));
            return true;
        }
    }
}

MUD.export(Go);
