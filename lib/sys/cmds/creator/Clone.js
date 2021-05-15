/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class CloneCommand extends Command {
    /**
     * Run the clone command
     * @param {string} txt
     * @param {MUDInputEvent} evt
     */
    async cmd(txt, evt) {

    }
}

module.exports = await createAsync(CloneCommand);
