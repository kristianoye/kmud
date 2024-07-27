/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from '@Base';
import Command from LIB_COMMAND;

export default final singleton class ShutdownCommand extends Command {
    override async cmd(args, cmdline) {
        try {
            if (!efuns.adminp(thisPlayer())) {
                writeLine('Access denied.');
                return;
            }
            writeLine('Shutting down...');
            thisPlayer().tellEnvironment(`${thisPlayer().displayName} shuts the game down.`);
            await efuns.shutdown(-5);
        }
        catch (x) {
            writeLine('Error: ' + x);
        }
    }
}
