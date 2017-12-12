MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Vis extends Command {
    cmd(args, cmdline) {
        if (efuns.wizardp(thisPlayer)) {
            if (thisPlayer.isVisible())
                return 'You are already visible.';
            thisPlayer.setProperty('visible', true);
            thisPlayer.writeLine('You emerge from the shadows.');
        }
        return true;
    }
}

MUD.export(Vis);
