MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class RmDir extends Command {
    cmd(args, cmdline) {
        try {
            var player = thisPlayer,
                dir = efuns.resolvePath(args[0], player.workingDirectory);

            if (efuns.rmdir(dir)) {
                thisPlayer.writeLine('Rmdir: {0}: Success'.fs(dir));
                FileIndex().removeDirectory(dir);
            } else {
                thisPlayer.writeLine('Failed to remove directory');
            }
            return true;
        }
        catch (x) {
            thisPlayer.writeLine('Error: ' + x);
        }
    }
}

MUD.export(RmDir);
