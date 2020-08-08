/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class Settings extends Command {
    webcmd() {
        eventSend({ type: 'openSettings' });
        return writeLine('Attempting to open settings...');
    }
}

module.exports = await createAsync(Settings);
