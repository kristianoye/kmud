/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class Emote extends Command {
    cmd(text) {
        writeLine(`You emote: ${thisPlayer().displayName} ${text}`);
        thisPlayer().tellEnvironment(`${thisPlayer().displayName} ${text}`);
        return true;
    }
}

module.exports = new Emote();
