/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

export default final singleton class RebootCommand extends Command {
    override cmd(args, cmdline) {
        if (!efuns.archp(thisPlayer)) {
            writeLine('Access denied.');
            return;
        }
        writeLine('Rebooting...');
        thisPlayer().tellEnvironment(`${thisPlayer().displayName} reboots ${efuns.mudName()}`);
        efuns.shutdown(0);
    }
}
