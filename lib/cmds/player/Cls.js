/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

 class Cls extends Command {
    cmd(args, cmdline) {
        thisPlayer.eventSend({ eventType: 'clearScreen' });
        return true;
    }
}

module.exports = new Cls();

