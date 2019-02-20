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
            write('Access denied.');
            return;
        }
        write('Rebooting...');
        thisPlayer().tellEnvironment(`${thisPlayer().displayName} reboots ${efuns.mudName()}`);
        efuns.shutdown(0);
    }
}

module.exports = new RebootCommand();
