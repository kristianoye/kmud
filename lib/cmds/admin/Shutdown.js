MUD.include('Base');

MUD.imports(LIB_COMMAND);

class Shutdown extends Command {
    cmd(args, cmdline) {
        try {
            if (!efuns.archp(thisPlayer)) {
                thisPlayer.writeLine('Access denied.');
                return;
            }
            thisPlayer.writeLine('Shutting down...');
            thisPlayer.tellEnvironment('{0} shuts the game down.'.fs(thisPlayer.displayName));
            efuns.shutdown(-5);
        }
        catch (x) {
            thisPlayer.writeLine('Error: ' + x);
        }
    }
}

MUD.export(Shutdown);
