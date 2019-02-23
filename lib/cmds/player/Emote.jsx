/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class Emote extends Command {
    cmd(args, cmdline) {
        writeLine(`You emote: ${thisPlayer().displayName} ${cmdline.input}`);
        thisPlayer().tellEnvironment(`${thisPlayer().displayName} ${cmdline.input}`);
        return true;
    }

    getHelp() {
        return (<div>This is 
            a test.
        </div>);
    }
}

module.exports = new Emote();
