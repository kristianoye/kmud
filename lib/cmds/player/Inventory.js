/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class Inventory extends Command {
    cmd(args, cmdline) {
        let shorts = {},
            inv = thisPlayer().inventory,
            lines = [];

        if (inv.length === 0)
            return writeLine('You are not carrying anything.');
        else {
            for (let i = 0, l = inv.length; i < l; i++) {
                let s = inv[i].shortDesc;
                if (!(s in shorts)) shorts[s] = { count: 0, weight: 0 };
                shorts[s]['count']++;
                shorts[s]['weight'] += inv[i].getWeight() || 0;
            }
            writeLine(efuns.sprintf('%-10s %-10s %s', 'Weight', 'Qty', 'Description'));
            for (let k in shorts) {
                writeLine(efuns.sprintf('%-10.2f %-10d %s',
                    shorts[k]['weight'],
                    shorts[k]['count'],
                    efuns.consolidate(shorts[k]['count'], k).ucfirst()));
            }
        }

        return true;
    }
}

module.exports = new Inventory();
