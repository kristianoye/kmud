/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import { PLAYER_D } from 'Daemon';
import Command from LIB_COMMAND;

export default singleton class HistoryCommand extends Command {
    override async cmd(args) {
        let history = thisPlayer().history;

        for (let i = 0; i < history.length; i++) {
            writeLine(history[i]);
        }
        return true;
    }
}
