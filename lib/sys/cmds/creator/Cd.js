MUD.include('Base');
MUD.imports(LIB_COMMAND);

class Cd extends Command {
    cmd(args) {
        var player = thisPlayer,
            path = efuns.resolvePath(args[0] || '~', player.workingDirectory);

        if (efuns.isDirectory(path)) {
            player.workingDirectory = path;
            player.writeLine('Directory changed');
        }
        else {
            player.writeLine('No such file or directory: ' + path);
        }
        return true;
    }
}

MUD.export(Cd);
