MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

var I3Daemon = efuns.loadObject('/daemon/I3Daemon');

class Mudlist extends Command {
    cmd(args, cmdline) {
        if (args.length === 0) {
            var mudList = I3Daemon().getMudList();
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

MUD.export(Mudlist);
