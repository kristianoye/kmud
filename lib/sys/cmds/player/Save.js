/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;
import { PLAYER_D } from 'Daemon';

export default singleton class SaveCommand extends Command {
    /**
     * 
     * @param {string[]} args
     * @param {MUDInputEvent} evt
     */
    override async cmd(args, evt) {
        await PLAYER_D->ensureSaveDirectoryExists();
        await thisPlayer().saveAsync();
        return writeLine('You have been saved!');
    }
}
