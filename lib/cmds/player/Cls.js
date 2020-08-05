/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

 class Cls extends Command {
    cmd(args, cmdline) {
        eventSend({ type: 'clearScreen' });
        return true;
    }
}

module.exports = new Cls();

