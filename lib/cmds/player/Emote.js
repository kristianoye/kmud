﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from '@Base';
import Command from LIB_COMMAND;

export default singleton class Emote extends Command {
    override cmd(text) {
        let player = thisPlayer();

        writeLine(`You emote: ${thisPlayer().displayName} ${text}`);
        message('thirdPerson',
            `${player.displayName} ${text}`,
            player.environment.inventory, player);
        return true;
    }
}
