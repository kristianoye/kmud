/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class ShutdownCommand extends Command {
    async cmd(args, cmdline) {
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

module.exports = await createAsync(ShutdownCommand);
