/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

export default singleton class Goto extends Command {
    /**
     * 
     * @param {string[]} args
     */
    override async cmd(txt, cmd) {
        if (!txt)
            return 'Where do you wish to go exactly?';

        let target = efuns.living.findPlayer(txt, true),
            tp = thisPlayer().instance;

        if (target) {
            if (target.instance === thisPlayer()) {
                return 'You twitch.';
            }
            else if (!target.environment) {
                return `${target.instance.displayName} appears to be in the void.`;
            }
            else if (target.environment === tp.environment) {
                return 'You twitch.';
            }
            else if (!await tp.movePlayerAsync(target.environment)) {
                return 'You fail to move anywhere.';
            }
        }
        else {
            try {
                let path = efuns.resolvePath(cmd.args[0], tp.workingDirectory || '/');
                if (!await tp.movePlayerAsync(path))
                    return 'You fail to move anywhere.';
            }
            catch (err) {
                return `An error prevented you from moving: ${err}`;
            }
        }
        return true;
    }
}


