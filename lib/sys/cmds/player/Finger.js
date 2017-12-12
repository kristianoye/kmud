include('Base');

imports(LIB_COMMAND);

var PlayerDaemon = efuns.loadObject('/sys/daemon/PlayerDaemon');

class Finger extends Command {
    cmd(args) {
        if (args.length === 0)
            return 'Usage: finger <player name>';

        PlayerDaemon().loadPlayerData(args[0], function (player, err) {
            if (err) {
                thisPlayer.writeLine(err);
            }
            else {
                var data = player.props;
                thisPlayer.writeLine(data.title.replace('$N', data.displayName));
                thisPlayer.writeLine(`${data.displayName} is a ${data.gender} ${data.race}`);
                thisPlayer.writeLine(`In in the real world: ${data.realName}`);

                var player = efuns.findPlayer(args[0]);
                if (player) {
                    thisPlayer.writeLine(`On since ${new Date(data.lastLogin).toLocaleString()}`);
                }
                else {
                    thisPlayer.writeLine(`Last logged in at ${new Date(data.lastLogin).toLocaleString()}`);
                }
            }
        });
        return true;
    }
}