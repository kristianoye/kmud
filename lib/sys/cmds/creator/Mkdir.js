MUD.include('Base');

MUD.imports(LIB_COMMAND);

class MkDir extends Command {
    cmd(args, cmdline) {
        try {
            var player = thisPlayer,
                dir = efuns.resolvePath(args[0], player.workingDirectory);

            if (efuns.mkdir(dir)) {
                thisPlayer.writeLine('{0}: Success'.fs(dir));
                FileIndex().addDirectory(dir);
            } else {
                thisPlayer.writeLine('Failed to create directory');
            }
            return true;
        }
        catch (x) {
            thisPlayer.writeLine('Error: ' + x);
        }
    }
}

MUD.export(MkDir);
