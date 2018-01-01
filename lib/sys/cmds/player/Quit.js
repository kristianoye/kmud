MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Quit extends Command {
    cmd(args, cmdline) {
        thisPlayer.save(success => {
            if (success) {
                var msg = '{0} has left the game.'.fs(thisPlayer.displayName);
                efuns.write('Good-bye!');
                efuns.thisPlayer.destroy();
                var chatDaemon = efuns.loadObject("/daemon/ChatDaemon");
                if (chatDaemon)
                    chatDaemon().broadcast('announce', msg);
            }
        });
        return true;
    }
}

MUD.export(Quit);
