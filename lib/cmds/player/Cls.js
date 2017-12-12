MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

 class Cls extends Command {
    cmd(args, cmdline) {
        thisPlayer.eventSend({ eventType: 'clearScreen' });
        return true;
    }
}

 MUD.export(Cls);

