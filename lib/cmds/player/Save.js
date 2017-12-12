MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Save extends Command {
    cmd(args, cmdline) {
        var player = thisPlayer;
        thisPlayer.save(function (success) {
            player.writeLine(success ? 'Saved successfully.' : 'Save failed');
        });
        return true;
    }
}

MUD.export(Save);
