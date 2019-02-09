/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class Settings extends Command {
    webcmd(args) {
        thisPlayer().eventSend({ eventType: 'openSettings' });
        return true;
    }
}

module.exports = new Settings();

