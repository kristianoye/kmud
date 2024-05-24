/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from '@Base';
import { PLAYER_D } from '@Daemon';
import Command from LIB_COMMAND;

export default singleton class FingerCommand extends Command {
    override async cmd(args) {
        if (args.length === 0)
            return 'Usage: finger <player name>';

        let playerData = await PLAYER_D->loadPlayerData(args[0]);
        if (playerData) {
            if (err) {
                writeLine(err);
            }
            else {
                let data = player.props;
                writeLine(data.title.replace('$N', data.displayName));
                writeLine(`${data.displayName} is a ${data.gender} ${data.race}`);
                writeLine(`In in the real world: ${data.realName}`);

                let player = efuns.living.findPlayer(args[0]);
                if (player) {
                    writeLine(`On since ${new Date(data.lastLogin).toLocaleString()}`);
                }
                else {
                    writeLine(`Last logged in at ${new Date(data.lastLogin).toLocaleString()}`);
                }
            }
        }
        else {
            writeLine(`Could not find player named ${args[0]}`);
        }
        return true;
    }
}
