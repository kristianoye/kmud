/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class QuitCommand extends Command {
    cmd(args, cmdline) {
        thisPlayer.save(success => {
            if (success) {
                var msg = `${thisPlayer.displayName} has left the game.`;
                efuns.write('Good-bye!');
                efuns.thisPlayer().destroy();
                var chatDaemon = efuns.loadObject("/daemon/ChatDaemon");
                if (chatDaemon)
                    chatDaemon().broadcast('announce', msg);
            }
        });
        return true;
    }
}

module.exports = new QuitCommand();
