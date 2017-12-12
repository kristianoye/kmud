
MUD.include('Base');

MUD.imports(LIB_COMMAND);

class Settings extends Command {
    webcmd(args) {
        thisPlayer.eventSend({ eventType: 'openSettings' });
        return true;
    }
}

MUD.export(Settings);
