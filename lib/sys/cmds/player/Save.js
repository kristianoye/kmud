/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Daemon = require('Daemon'),
    Command = require(Base.Command),
    PlayerDaemon = efuns.loadObjectSync(Daemon.Player);

class SaveCommand extends Command {
    /**
     * 
     * @param {string[]} args
     * @param {MUDInputEvent} evt
     */
    async cmd(args, evt) {
        await PlayerDaemon().ensureSaveDirectoryExists();

        thisPlayer().save();
        return writeLine('You have been saved! Hallelujah!');
    }
}

module.exports = new SaveCommand();

