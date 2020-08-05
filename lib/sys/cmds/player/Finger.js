/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Daemon = await requireAsync('Daemon'),
    Command = await requireAsync(Base.Command),
    PlayerDaemon = await efuns.loadObjectAsync(Daemon.Player);

class FingerCommand extends Command {
    cmd(args) {
        if (args.length === 0)
            return 'Usage: finger <player name>';

        PlayerDaemon().loadPlayerData(args[0], function (player, err) {
            if (err) {
                writeLine(err);
            }
            else {
                var data = player.props;
                writeLine(data.title.replace('$N', data.displayName));
                writeLine(`${data.displayName} is a ${data.gender} ${data.race}`);
                writeLine(`In in the real world: ${data.realName}`);

                var player = efuns.living.findPlayer(args[0]);
                if (player) {
                    writeLine(`On since ${new Date(data.lastLogin).toLocaleString()}`);
                }
                else {
                    writeLine(`Last logged in at ${new Date(data.lastLogin).toLocaleString()}`);
                }
            }
        });
        return true;
    }
}

module.exports = new FingerCommand();
