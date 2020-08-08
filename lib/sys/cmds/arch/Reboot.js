/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class RebootCommand extends Command {
    cmd(args, cmdline) {
        if (!efuns.archp(thisPlayer)) {
            writeLine('Access denied.');
            return;
        }
        writeLine('Rebooting...');
        thisPlayer().tellEnvironment(`${thisPlayer().displayName} reboots ${efuns.mudName()}`);
        efuns.shutdown(0);
    }
}

module.exports = await createAsync(RebootCommand);
