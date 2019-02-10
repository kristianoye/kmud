/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class UpdateCommand extends Command {
    cmd(args, cmdline) {
        if (args.length === 0 || !args[0])
            args[0] = thisPlayer().environment.filename;

        var path = efuns.resolvePath(args[0], thisPlayer().workingDirectory);
        write(`Update ${path}: ${(efuns.reloadObjectSync(path) ? '[OK]' : '[Failure]')}`);
        return true;
    }
}

module.exports = new UpdateCommand();
