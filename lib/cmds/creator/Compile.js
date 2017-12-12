MUD.include('Base');

MUD.imports(LIB_COMMAND);

class Compile extends Command {
    cmd(args) {
        var player = thisPlayer,
            path = efuns.resolvePath(args[0], player.workingDirectory);

        try {
            var result = this.compileObject(path, true);
            thisPlayer.writeLine(JSON.stringify(result));
        }
        catch (x) {
            thisPlayer.writeLine('No bueno: ' + x);
            thisPlayer.writeLine(x.stack);
        }
    }
}

MUD.export(Compile);
