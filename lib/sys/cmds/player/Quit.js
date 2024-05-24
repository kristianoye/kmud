/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from '@Base';
import Command from LIB_COMMAND;

export default singleton class QuitCommand extends Command {

    override async cmd() {
        let player = thisPlayer();

        if (await player.saveAsync()) {
            writeLine('Your character has been saved.');
            return efuns.destruct(player) || 'Something went wrong!';
        }
        return writeLine('Your character was not saved; Quit aborted!');
    }
}
