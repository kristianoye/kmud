/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;
import { INTERMUD_D } from 'Daemon';

export default singleton class Mudlist extends Command {
    override cmd(args, cmdline) {
        if (args.length === 0) {
            let mudList = INTERMUD_D->getMudList();
            mudList.forEach(mud => {
                writeLine(efuns.sprintf('%-20s %-10s %-10s', mud.name, mud.mudlib, mud.driver));
            });
            if (mudList.length === 0) {
                writeLine('No MUDs found at this time.');
            }
            return true;
        }
        else {
            for (var k in mudList) {
                norm[k.toLowerCase()] = mudList[k];
            }
            for (var i = 0; i < args.length; i++) {
                var name = cmdline.toLowerCase();
                if (!norm[name])
                    writeLine(`There is no MUD named ${name} that we are aware of.`);
                else {
                    writeLine('MUD Name: ' + JSON.stringify(norm[name]));
                }
            }
        }
    }
}
