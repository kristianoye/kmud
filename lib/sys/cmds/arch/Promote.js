/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command),
    Daemon = require('Daemon'),
    PlayerDaemon = efuns.loadObjectSync(Daemon.Player),
    ChatDaemon = efuns.loadObjectSync(Daemon.Chat);

class PromoteCommand extends Command {
    cmd(args, cmdline) {
        try {
            if (!efuns.archp(thisPlayer)) return 'Access denied.';
            if (args.length === 0) return 'Whom did you wish to promote?';
            var player = efuns.findPlayer(args[0]);
            if (!player) return 'Player not found';
            if (efuns.wizardp(player)) return 'They are already a wizard!';

            if (PlayerDaemon().createWizard(player))
            {
                ChatDaemon().broadcast('announce', `${(player.displayName || player().displayName)} was just promoted to Immortal status!`);
            }
            return 'Done';
        }
        catch (x) {
            thisPlayer.writeLine('Error: ' + x);
        }
    }
}

module.exports = new PromoteCommand();
