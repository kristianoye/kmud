/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class SaveCommand extends Command {
    /**
     * 
     * @param {string[]} args
     * @param {MUDInputEvent} evt
     */
    cmd(args, evt) {
        thisPlayer().save(function (success) {
            writeLine(success ? 'Saved successfully.' : 'Save failed');
            return evt.complete();
        });
        return writeLine('You have been saved! Hallelujah!');
    }
}

module.exports = new SaveCommand();

