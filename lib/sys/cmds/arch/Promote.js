/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from '@Base';
import Command from LIB_COMMAND;
import { PLAYER_D, CHAT_D } from '@Daemon';

class PromoteCommand extends Command {
    override cmd(args, cmdline) {
        try {
            if (!efuns.archp(thisPlayer)) return 'Access denied.';
            if (args.length === 0) return 'Whom did you wish to promote?';
            var player = efuns.living.findPlayer(args[0]);
            if (!player)
                return 'Player not found';
            if (efuns.living.isWizardp(player))
                return 'They are already a wizard!';

            if (PLAYER_D->createWizard(player))
            {
                CHAT_D->broadcast('announce', `${(player.displayName || player().displayName)} was just promoted to Immortal status!`);
            }
            return 'Done';
        }
        catch (x) {
            writeLine('Error: ' + x);
        }
    }
}

module.exports = await createAsync(PromoteCommand);
