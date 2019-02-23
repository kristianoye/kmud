/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class CompileCommand extends Command {
    cmd(args) {
        var player = thisPlayer,
            path = efuns.resolvePath(args[0], player.workingDirectory);

        try {
            var result = this.compileObject({ file: path, reload: true });
            writeLine(JSON.stringify(result));
        }
        catch (x) {
            writeLine('No bueno: ' + x);
            writeLine(x.stack);
        }
    }
}

module.exports = new CompileCommand();
