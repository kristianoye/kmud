/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

export default singleton class CDCommand extends Command {
    override async cmd(args) {
        var player = thisPlayer,
            path = efuns.resolvePath(args[0] || '~', player.workingDirectory),
            isDir = await efuns.fs.isDirectoryAsync(path)

        if (isDir === true) {
            player.workingDirectory = path;
            writeLine('Directory changed');
        }
        else {
            writeLine('No such file or directory: ' + path);
        }
        return true;
    }
}
