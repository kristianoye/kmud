MUD.include('Base');

MUD.imports(LIB_COMMAND);

class Pwd extends Command {
    cmd(args) {
        var player = thisPlayer;
        player.writeLine('Working directory: ' + player.workingDirectory);
    }
}

MUD.export(Pwd);
