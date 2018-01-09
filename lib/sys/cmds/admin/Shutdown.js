MUD.include('Base');

MUD.imports(LIB_COMMAND);

class Shutdown extends Command {
    cmd(args, cmdline) {
        try {
            if (!efuns.adminp(thisPlayer)) {
                thisPlayer.writeLine('Access denied.');
                return;
            }
            thisPlayer.writeLine('Shutting down...');
            thisPlayer.tellEnvironment(`${thisPlayer.displayName} shuts the game down.`);
            efuns.shutdown(-5);
        }
        catch (x) {
            thisPlayer.writeLine('Error: ' + x);
        }
    }
}

MUD.export(Shutdown);
