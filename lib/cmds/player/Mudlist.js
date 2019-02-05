/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Daemon = require('Daemon'),
    Command = require(Base.Command),
    I3Daemon = efuns.loadObjectSync(Daemon.I3Daemon);

class Mudlist extends Command {
    cmd(args, cmdline) {
        if (args.length === 0) {
            let mudList = I3Daemon().getMudList();
            mudList.forEach(mud => {
                thisPlayer.writeLine(efuns.sprintf('%-20s %-10s %-10s', mud.name, mud.mudlib, mud.driver));
            });
            if (mudList.length === 0) {
                thisPlayer.writeLine('No MUDs found at this time.');
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
                    thisPlayer.writeLine(`There is no MUD named ${name} that we are aware of.`);
                else {
                    thisPlayer.writeLine('MUD Name: ' + JSON.stringify(norm[name]));
                }
            }
        }
    }
}

module.exports = new Mudlist();
