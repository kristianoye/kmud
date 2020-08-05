/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class ChmodCommand extends Command {
    cmd(args) {
        if (args.length === 0)
            return 'Usage: chmod [options] file(s)...';
        let path = efuns.resolvePath(args[0], thisPlayer().workingDirectory);
        throw new Error('Not implemented');
    }
}

module.exports = new ChmodCommand();
