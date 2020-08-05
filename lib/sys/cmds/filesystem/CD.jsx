/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class CDCommand extends Command {
    async cmd(args) {
        var player = thisPlayer,
            path = efuns.resolvePath(args[0] || '~', player.workingDirectory),
            isDir = efuns.fs.isDirectoryAsync(path)

        if (efuns.isDirectorySync(path)) {
            player.workingDirectory = path;
            writeLine('Directory changed');
        }
        else {
            writeLine('No such file or directory: ' + path);
        }
        return true;
    }
}

module.exports = new CDCommand();
