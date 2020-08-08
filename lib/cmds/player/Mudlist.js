/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Daemon = await requireAsync('Daemon'),
    Command = await requireAsync(Base.Command),
    I3Daemon = await efuns.loadObjectAsync(Daemon.I3Daemon);

class Mudlist extends Command {
    cmd(args, cmdline) {
        if (args.length === 0) {
            let mudList = I3Daemon().getMudList();
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

module.exports = await createAsync(Mudlist);
