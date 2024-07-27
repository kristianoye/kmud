/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from '@Base';
import Command from LIB_COMMAND;

export default singleton class Go extends Command {
    override async cmd(text) {
        let player = thisPlayer(),
            env = player.environment;

        if (!text)
            return errorLine('Which way do you wish to go?');

        else if (!env) 
            return errorLine('You appear to be in the void');

        else if (!env.hasExit(text))
            return errorLine(`You cannot go ${text}`);

        else {
            if (!await player.eventMoveAsync('walk', text, env.getExit(text)))
                return errorLine(`You go nowhere despite the exit ${text} being clearly visible to you.`);
            return true;
        }
    }
}


