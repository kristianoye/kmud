/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class RebootCommand extends Command {
    cmd(args, cmdline) {
        if (!efuns.archp(thisPlayer)) {
            thisPlayer.writeLine('Access denied.');
            return;
        }
        thisPlayer.writeLine('Rebooting...');
        thisPlayer.tellEnvironment(`${thisPlayer.displayName} reboots ${efuns.mudName()}`);
        efuns.shutdown(0);
    }
}

module.exports = new RebootCommand();
