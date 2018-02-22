MUD.include('Base');

MUD.imports(LIB_COMMAND);

class Invis extends Command {
    cmd(args, cmdline) {
        if (efuns.wizardp(thisPlayer)) {
            if (!thisPlayer.isVisible())
                return 'You are already invisible.';
            thisPlayer.setProperty('visible', false);
            thisPlayer.writeLine('You slip into the shadows.');
        }
        return true;
    }
}
MUD.export(Invis);
