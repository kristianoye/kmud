/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class Go extends Command {
    cmd(args, cmdline) {
        var env = thisPlayer().environment;
        if (args.length === 0) {
            writeLine('Which way do you wish to go?');
        }
        else if (!env) {
            return writeLine('You appear to be in the void');
        }
        else if (!env.hasExit(args[0])) {
            return writeLine(`You cannot go ${args[0]}`);
        }
        else {
            thisPlayer().eventMove('walk', args[0], env.getExit(args[0]));
            writeLine(`You go ${args[0]}`);
            return true;
        }
    }
}

module.exports = Go;

