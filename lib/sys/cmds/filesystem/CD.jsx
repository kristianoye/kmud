/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class CDCommand extends Command {
    cmd(args) {
        var player = thisPlayer,
            path = efuns.resolvePath(args[0] || '~', player.workingDirectory);

        if (efuns.isDirectorySync(path)) {
            player.workingDirectory = path;
            write('Directory changed');
        }
        else {
            write('No such file or directory: ' + path);
        }
        return true;
    }
}

module.exports = new CDCommand();
