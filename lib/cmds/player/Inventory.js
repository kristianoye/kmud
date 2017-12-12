MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Inventory extends Command {
    cmd(args, cmdline) {
        var shorts = {},
            inv = thisPlayer.inventory,
            lines = [];

        if (inv.length === 0)
            thisPlayer.writeLine('You are not carrying anything.');
        else {
            for (var i = 0, l = inv.length; i < l; i++) {
                var s = inv[i].shortDescription;
                if (!(s in shorts)) shorts[s] = { count: 0, weight: 0 };
                shorts[s]['count']++;
                shorts[s]['weight'] += inv[i].getWeight() || 0;
            }
            thisPlayer.writeLine(efuns.sprintf('%-10s %-10s %s', 'Weight', 'Qty', 'Description'));
            for (var k in shorts) {
                thisPlayer.writeLine(efuns.sprintf('%-10.2f %-10d %s',
                    shorts[k]['weight'],
                    shorts[k]['count'],
                    efuns.consolidate(shorts[k]['count'], k).ucfirst()));
            }
        }

        return true;
    }
}

MUD.export(Inventory);
