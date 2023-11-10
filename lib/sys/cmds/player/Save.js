/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Daemon = await requireAsync('Daemon'),
    Command = await requireAsync(Base.Command),
    PlayerDaemon = await efuns.loadObjectAsync(Daemon.Player);

class SaveCommand extends Command {
    /**
     * 
     * @param {string[]} args
     * @param {MUDInputEvent} evt
     */
    async cmd(args, evt) {
        await PlayerDaemon().ensureSaveDirectoryExists();

        await thisPlayer().saveAsync();

        return writeLine('You have been saved!');
    }
}

module.exports = await createAsync(SaveCommand);

