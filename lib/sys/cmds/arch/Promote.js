MUD.include('Base');

MUD.import(LIB_COMMAND);

var PlayerDaemon = efuns.loadObject('/sys/daemon/PlayerDaemon'),
    ChatDaemon = efuns.loadObject('/daemon/ChatDaemon');

class Promote extends Command {
    cmd(args, cmdline) {
        try {
            if (!efuns.archp(thisPlayer)) return 'Access denied.';
            if (args.length === 0) return 'Whom did you wish to promote?';
            var player = efuns.findPlayer(args[0]);
            if (!player) return 'Player not found';
            if (efuns.wizardp(player)) return 'They are already a wizard!';

            if (PlayerDaemon().createWizard(player))
            {
                ChatDaemon().broadcast('announce', '{0} was just promoted to Immortal status!'.fs(player.displayName || player().displayName));
            }
            return 'Done';
        }
        catch (x) {
            thisPlayer.writeLine('Error: ' + x);
        }
    }
}
