/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class ShutdownCommand extends Command {
    cmd(args, cmdline) {
        try {
            if (!efuns.adminp(thisPlayer)) {
                write('Access denied.');
                return;
            }
            write('Shutting down...');
            thisPlayer().tellEnvironment(`${thisPlayer().displayName} shuts the game down.`);
            efuns.shutdown(-5);
        }
        catch (x) {
            write('Error: ' + x);
        }
    }
}

module.exports = new ShutdownCommand();
