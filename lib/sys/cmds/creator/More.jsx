﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class MoreCommand extends Command {
    cmd(args, cmdline) {
        try {
            if (args.length === 0) 'Usage: more <filename>';
            var player = thisPlayer,
                fullpath = efuns.resolvePath(args[0], thisPlayer.workingDirectory);

            if (args[0] === 'here') fullpath = thisPlayer.environment.filename + '.js';

            if (!efuns.isFile(fullpath))
                return fullpath + ' is not a file.';

            efuns.readFile(fullpath, (content) => {
                thisPlayer.writeLine(content);
                cmdline.complete();
            });
        }
        catch (x) {
            thisPlayer.writeLine('Error: ' + x);
        }
        return cmdline.complete;
    }

    webcmd(args, cmdline) {
        try {
            if (args.length === 0) {
                thisPlayer.writeLine('Usage: more <filename>');
            }
            var player = thisPlayer,
                fullpath = efuns.resolvePath(args[0], player.workingDirectory);

            efuns.readFile(fullpath, (content, err) => {
                thisPlayer.writeLine('<pre>' + content + '</pre>');
            });
        }
        catch (x) {
            thisPlayer.writeLine('Error: ' + x);
        }
    }
}

module.exports = new MoreCommand();